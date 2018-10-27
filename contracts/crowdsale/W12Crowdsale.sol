pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "./IW12Crowdsale.sol";
import "./IW12Fund.sol";
import "../rates/IRates.sol";
import "../libs/Percent.sol";
import "../libs/PaymentMethods.sol";
import "../libs/PurchaseProcessing.sol";
import "../versioning/Versionable.sol";
import "../token/IWToken.sol";

contract W12Crowdsale is Versionable, IW12Crowdsale, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using Percent for uint;
    using BytesLib for bytes;
    using PaymentMethods for PaymentMethods.Methods;

    IWToken public token;
    ERC20 public originToken;
    IW12Fund public fund;
    IRates public rates;
    uint public price;
    uint public serviceFee;
    uint public WTokenSaleFeePercent;
    address public serviceWallet;
    address public swap;

    // list of payment methods
    PaymentMethods.Methods paymentMethods;

    Stage[] public stages;
    Milestone[] public milestones;

    struct Stage {
        uint32 startDate;
        uint32 endDate;
        uint discount;
        uint32 vesting;
        uint[] volumeBoundaries;
        uint[] volumeBonuses;
    }

    struct Milestone {
        uint32 endDate;
        uint tranchePercent;
        uint32 voteEndDate;
        uint32 withdrawalWindow;
        bytes name;
        bytes description;
    }

    event TokenPurchase(address indexed buyer, uint tokensBought, uint cost, uint change);
    event StagesUpdated();
    event StageUpdated(uint index);
    event MilestonesUpdated();
    event CrowdsaleSetUpDone();
    event UnsoldTokenReturned(address indexed owner, uint amount);

    constructor (
        uint version,
        address _originToken,
        address _token,
        uint _price,
        address _serviceWallet,
        address _swap,
        uint _serviceFee,
        uint _WTokenSaleFeePercent,
        IW12Fund _fund,
        IRates _rates
    )
        Versionable(version) public
    {
        require(_originToken != address(0));
        require(_token != address(0));
        require(_serviceFee.isPercent() && _serviceFee.fromPercent() < 100);
        require(_WTokenSaleFeePercent.isPercent() && _WTokenSaleFeePercent.fromPercent() < 100);
        require(_fund != address(0));
        require(_swap != address(0));
        require(_rates != address(0));

        __setParameters(_price, _serviceWallet);

        token = IWToken(_token);
        originToken = ERC20(_originToken);
        serviceFee = _serviceFee;
        swap = _swap;
        WTokenSaleFeePercent = _WTokenSaleFeePercent;
        fund = _fund;
        rates = _rates;
    }

    function stagesLength() external view returns (uint) {
        return stages.length;
    }

    function milestonesLength() external view returns (uint) {
        return milestones.length;
    }

    function getMilestone(uint index) public view returns (uint32, uint, uint32, uint32, bytes, bytes) {
        return (
            milestones[index].endDate,
            milestones[index].tranchePercent,
            milestones[index].voteEndDate,
            milestones[index].withdrawalWindow,
            milestones[index].name,
            milestones[index].description
        );
    }

    function getStage(uint index) public view returns (uint32, uint32, uint, uint32, uint[], uint[]) {
        return (
            stages[index].startDate,
            stages[index].endDate,
            stages[index].discount,
            stages[index].vesting,
            stages[index].volumeBoundaries,
            stages[index].volumeBonuses
        );
    }

    function getEndDate() external view returns (uint32) {
        require(stages.length > 0);

        return stages[stages.length - 1].endDate;
    }

    /**
     * @dev Returns index of active milestone or last milestone
     */
    function getCurrentMilestoneIndex() public view returns (uint index, bool found) {
        if(milestones.length == 0 || !isEnded()) return;

        found = true;

        // from withdrawalWindow begins next milestone
        while(index < milestones.length - 1 && now >= milestones[index].withdrawalWindow) {
            index++;
        }
    }

    function getLastMilestoneIndex() public view returns (uint index, bool found) {
        if (milestones.length == 0 || !isEnded()) return;

        found = true;
        index = milestones.length - 1;
    }

    function __setParameters(uint _price, address _serviceWallet) internal {
        require(_price > 0);
        require(_serviceWallet != address(0));

        price = _price;
        serviceWallet = _serviceWallet;
    }

    function setParameters(uint _price) external onlyOwner beforeSaleStart {
        __setParameters(_price, serviceWallet);
    }

    /**
     * @dev Setup all crowdsale parameters at a time
     */
    function setup(
        uint[6][] parametersOfStages,
        uint[] bonusConditionsOfStages,
        uint[4][] parametersOfMilestones,
        uint32[] nameAndDescriptionsOffsetOfMilestones,
        bytes nameAndDescriptionsOfMilestones,
        bytes32[] paymentMethodsList
    )
        external onlyOwner beforeSaleStart
    {
        // primary check of parameters of stages
        require(parametersOfStages.length != 0);
        require(parametersOfStages.length <= uint8(- 1));

        // primary check of parameters of milestones
        require(parametersOfMilestones.length <= uint8(- 1));
        require(parametersOfMilestones.length == nameAndDescriptionsOffsetOfMilestones.length / 2);
        require(parametersOfMilestones.length <= nameAndDescriptionsOfMilestones.length / 2);

        // check payment methods list
        require(paymentMethodsList.length != 0);

        for (uint i = 0; i < paymentMethodsList.length; i++) {
            require(rates.hasSymbol(paymentMethodsList[i]));
        }

        _setStages(
            parametersOfStages,
            bonusConditionsOfStages
        );

        _setMilestones(
            parametersOfMilestones,
            nameAndDescriptionsOffsetOfMilestones,
            nameAndDescriptionsOfMilestones
        );

        paymentMethods.update(paymentMethodsList);

        emit CrowdsaleSetUpDone();
    }

    /**
     * @dev Update stages
     * @param parameters List of primary parameters:
     * [
     *   uint32 startDate,
     *   uint32 endDate,
     *   uint discount,
     *   uint32 vesting,
     *   uint8 startIndexOfBonusConditions
     *   uint8 endIndexOfBonusConditions
     * ],
     * @param bonusConditions List of bonus conditions:
     * [uint boundary, uint bonus, ...]
     */
    function _setStages(uint[6][] parameters, uint[] bonusConditions) internal {
        if (milestones.length > 0) {
            // end date of firs milestone must be greater then end date of last stage
            require(milestones[0].endDate > parameters[parameters.length - 1][1]);
        }

        delete stages;

        for (uint8 i = 0; i < parameters.length; i++) {
            // check overflow
            require(parameters[i][0] <= uint32(-1));
            require(parameters[i][1] <= uint32(-1));
            require(parameters[i][3] <= uint32(-1));
            require(parameters[i][4] <= uint8(-1));
            require(parameters[i][5] <= uint8(-1));

            // check dates
            require(parameters[i][0] > now);
            require(parameters[i][0] < parameters[i][1]);

            if (i > 0) {
                require(parameters[i - 1][1] <= parameters[i][0]);
            }

            // check discount
            require(parameters[i][2].isPercent());
            require(parameters[i][2] < Percent.MAX());

            stages.push(Stage({
                startDate: uint32(parameters[i][0]),
                endDate: uint32(parameters[i][1]),
                discount: parameters[i][2],
                vesting: uint32(parameters[i][3]),
                volumeBoundaries: new uint[](0),
                volumeBonuses: new uint[](0)
            }));

            _setStageBonusConditions(
                uint8(stages.length - 1),
                uint8(parameters[i][4]),
                uint8(parameters[i][5]),
                bonusConditions
            );
        }

        emit StagesUpdated();
    }

    /**
     * @dev Set stage bonus conditions by stage index
     * @param bonusConditions List of bonus conditions:
     * [uint boundary, uint bonus, ...]
     */
    function _setStageBonusConditions(uint8 stageIndex, uint8 start, uint8 end, uint[] bonusConditions) internal {
        if (start == 0 && end == 0) {
            stages[stageIndex].volumeBoundaries = new uint[](0);
            stages[stageIndex].volumeBonuses = new uint[](0);

            return;
        }

        require(end <= bonusConditions.length);
        require(start < end);
        require(start % 2 == 0);
        require(end % 2 == 0);

        uint[] memory boundaries = new uint[]((end - start) / 2);
        uint[] memory bonuses = new uint[]((end - start) / 2);
        uint k = 0;

        while (start < end) {
            // check bonus
            require(bonusConditions[start + 1].isPercent());
            require(bonusConditions[start + 1] < Percent.MAX());

            // check boundary
            if (k > 0) {
                require(boundaries[k - 1] < bonusConditions[start]);
            }

            boundaries[k] = bonusConditions[start];
            bonuses[k] = bonusConditions[start + 1];
            k++;
            start += 2;
        }

        stages[stageIndex].volumeBoundaries = boundaries;
        stages[stageIndex].volumeBonuses = bonuses;
    }

    /**
     * @dev Update milestones
     * @param parameters List of primary parameters:
     * [
     *   uint32 endDate,
     *   uint32 voteEndDate,
     *   uint32 withdrawalWindow,
     *   uint tranchPercent
     * ]
     * @param offsets Offsets of names and descriptions in namesAndDescriptions:
     * [uint32 offset1, uint32 offset2, ...]
     * @param namesAndDescriptions Names and descriptions
     */
    function _setMilestones(
        uint[4][] parameters,
        uint32[] offsets,
        bytes namesAndDescriptions
    )
        internal
    {
        if (stages.length > 0) {
            require(stages[stages.length - 1].endDate < parameters[0][0]);
        }

        delete milestones;

        uint offset = 0;
        uint k = 0;
        uint totalPercents = 0;

        for (uint8 i = 0; i < parameters.length; i++) {
            // check overflow
            require(parameters[i][0] <= uint32(- 1));
            require(parameters[i][1] <= uint32(- 1));
            require(parameters[i][2] <= uint32(- 1));

            // check dates
            require(parameters[i][0] > now);
            require(parameters[i][1] > parameters[i][0]);
            require(parameters[i][2] > parameters[i][1]);

            if (i > 0) {
                require(parameters[i - 1][2] < parameters[i][0]);
            }

            // check tranch percent
            require(parameters[i][3].isPercent());

            bytes memory name = namesAndDescriptions.slice(offset, offsets[k]);
            offset = offset.add(offsets[k]);
            bytes memory description = namesAndDescriptions.slice(offset, offsets[k + 1]);
            offset = offset.add(offsets[k + 1]);
            k = k.add(2);

            totalPercents = totalPercents.add(parameters[i][3]);

            milestones.push(Milestone({
                endDate: uint32(parameters[i][0]),
                tranchePercent: parameters[i][3],
                voteEndDate: uint32(parameters[i][1]),
                withdrawalWindow: uint32(parameters[i][2]),
                name: name,
                description: description
            }));
        }

        require(totalPercents == Percent.MAX());

        emit MilestonesUpdated();
    }

    function buyTokens(bytes32 method, uint amount) payable public nonReentrant onlyWhenSaleActive {
        if (PurchaseProcessing.METHOD_ETH() != method) {
            require(rates.getTokenAddress(method) != address(0));
        }

        (uint index, /*bool found*/) = getCurrentStageIndex();

        uint[5] memory invoice = getInvoice(method, amount);
        uint[2] memory fee = getFee(invoice[0], invoice[1]);

        _transferFee(fee, method);
        _transferPurchase(invoice, fee, stages[index].vesting, method);
        _recordPurchase(invoice, fee, method);

        emit TokenPurchase(msg.sender, invoice[0], invoice[1], invoice[3]);
    }

    function _transferFee(uint[2] _fee, bytes32 method) internal {
        PurchaseProcessing.transferFee(
            _fee,
            method,
            rates.isToken(method) ? rates.getTokenAddress(method) : address(0),
            address(token),
            address(originToken),
            swap,
            serviceWallet
        );
    }

    function _transferPurchase(uint[5] _invoice, uint[2] _fee, uint32 vesting, bytes32 method) internal {
        PurchaseProcessing.transferPurchase(
            _invoice,
            _fee,
            vesting,
            method,
            rates.isToken(method) ? rates.getTokenAddress(method) : address(0),
            address(token)
        );
    }

    function _recordPurchase(uint[5] _invoice, uint[2] _fee, bytes32 method) internal {
        if (method == PurchaseProcessing.METHOD_ETH()) {
            fund.recordPurchase.value(_invoice[1].sub(_fee[1]))(msg.sender, _invoice[0], method, _invoice[1].sub(_fee[1]), _invoice[2]);
        } else {
            require(ERC20(rates.getTokenAddress(method)).transfer(address(fund), _invoice[1].sub(_fee[1])));
            fund.recordPurchase(msg.sender, _invoice[0], method, _invoice[1].sub(_fee[1]), _invoice[2]);
        }
    }

    function getWToken() external view returns(IWToken) {
        return token;
    }

    function getFund() external view returns(IW12Fund) {
        return fund;
    }

    function getPaymentMethodsList() external view returns(bytes32[]) {
        return paymentMethods.list();
    }

    function isPaymentMethodAllowed(bytes32 _method) external view returns (bool) {
        return paymentMethods.isAllowed(_method);
    }

    function getInvoice(bytes32 method, uint amount) public view returns (uint[5]) {
        (uint index, bool found) = getCurrentStageIndex();

        if (!found) return;

        if (PurchaseProcessing.METHOD_ETH() != method) {
            if (!rates.isToken(method)) {
                return;
            }
        }

        return PurchaseProcessing.invoice(
            method,
            amount,
            stages[index].discount,
            stages[index].volumeBoundaries,
            stages[index].volumeBonuses,
            rates.get(method),
            price,
            uint(token.decimals()),
            PurchaseProcessing.METHOD_ETH() == method
                ? 18
                : uint(DetailedERC20(rates.getTokenAddress(method)).decimals()),
            token.balanceOf(address(this))
        );
    }

    function getInvoiceByTokenAmount(bytes32 method, uint tokenAmount) public view returns (uint[4]) {
        (uint index, bool found) = getCurrentStageIndex();

        if (!found) return;

        if (PurchaseProcessing.METHOD_ETH() != method) {
            if (!rates.isToken(method)) {
                return;
            }
        }

        return PurchaseProcessing.invoiceByTokenAmount(
            method,
            tokenAmount,
            stages[index].discount,
            stages[index].volumeBoundaries,
            stages[index].volumeBonuses,
            rates.get(method),
            price,
            uint(token.decimals()),
            PurchaseProcessing.METHOD_ETH() == method
                ? 18
                : uint(DetailedERC20(rates.getTokenAddress(method)).decimals()),
            token.balanceOf(address(this))
        );
    }

    function getFee(uint tokenAmount, uint cost) public view returns(uint[2]) {
        return PurchaseProcessing.fee(tokenAmount, cost, serviceFee, WTokenSaleFeePercent);
    }

    function getSaleVolumeBonus(uint value) public view returns(uint bonus) {
        (uint index, bool found) = getCurrentStageIndex();

        if (!found) return;

        Stage storage stage = stages[index];

        return PurchaseProcessing.getBonus(value, stage.volumeBoundaries, stage.volumeBonuses);
    }

    function getCurrentStageIndex() public view returns (uint index, bool found) {
        for(uint i = 0; i < stages.length; i++) {
            Stage storage stage = stages[i];

            if (stage.startDate <= now && stage.endDate > now) {
                return (i, true);
            }
        }

        return (0, false);
    }

    function claimRemainingTokens() external onlyOwner {
        require(isEnded());

        uint amount = token.balanceOf(address(this));

        require(token.transfer(owner, amount));

        emit UnsoldTokenReturned(owner, amount);
    }

    function isEnded() public view returns (bool) {
        return stages.length == 0 || stages[stages.length - 1].endDate < now;
    }

    function isSaleActive() public view returns (bool) {
        (, bool found) = getCurrentStageIndex();

        return found;
    }

    modifier beforeSaleStart() {
        if (stages.length > 0) {
            require(stages[0].startDate > now);
        }

        _;
    }

    modifier onlyWhenSaleActive() {
        require(isSaleActive(), "Sale is not started yet");

        _;
    }
}
