pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "./IW12Crowdsale.sol";
import "./IW12Fund.sol";
import "../rates/IRates.sol";
import "../libs/Percent.sol";
import "../libs/PaymentMethods.sol";
import "../libs/PurchaseProcessing.sol";
import "../libs/Crowdsale.sol";
import "../versioning/Versionable.sol";
import "../token/IWToken.sol";
import "../access/roles/AdminRole.sol";
import "../access/roles/ProjectOwnerRole.sol";


contract W12Crowdsale is IW12Crowdsale, AdminRole, ProjectOwnerRole, Versionable, Secondary, ReentrancyGuard {
    using SafeMath for uint;
    using SafeMath for uint8;
    using Percent for uint;
    using PaymentMethods for PaymentMethods.Methods;

    struct PaymentMethodPurchaseFee {
        bool has;
        uint value;
    }

    IWToken public token;
    IERC20 public originToken;
    IW12Fund public fund;
    IRates public rates;
    uint public price;
    uint public serviceFee;
    // solhint-disable-next-line var-name-mixedcase
    uint public WTokenSaleFeePercent;
    address public serviceWallet;
    address public swap;
    uint8 public project_type;
    string public project_name;
    uint public refund_date;

    // list of payment methods
    PaymentMethods.Methods private paymentMethods;
    mapping(bytes32 => PaymentMethodPurchaseFee) private paymentMethodsPurchaseFee;

    Crowdsale.Stage[] public stages;
    Crowdsale.Milestone[] public milestones;

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
        uint _wTokenSaleFeePercent,
        IW12Fund _fund,
        IRates _rates
    )
        public Versionable(version)
    {
        require(_originToken != address(0));
        require(_token != address(0));
        require(_serviceFee.isPercent() && _serviceFee.fromPercent() < 100);
        require(_wTokenSaleFeePercent.isPercent() && _wTokenSaleFeePercent.fromPercent() < 100);
        require(_fund != address(0));
        require(_swap != address(0));
        require(_rates != address(0));

        __setParameters(_price, _serviceWallet);

        token = IWToken(_token);
        originToken = IERC20(_originToken);
        serviceFee = _serviceFee;
        swap = _swap;
        WTokenSaleFeePercent = _wTokenSaleFeePercent;
        fund = _fund;
        rates = _rates;
    }

    function setParameters(uint _price) external onlyPrimary beforeSaleStart {
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
        external onlyProjectOwner beforeSaleStart
    {
        // primary check of parameters of stages
        require(parametersOfStages.length != 0);
        require(parametersOfStages.length <= uint8(-1));

        // primary check of parameters of milestones
        require(parametersOfMilestones.length <= uint8(-1));
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

    function claimRemainingTokens() external onlyProjectOwner {
        require(isEnded());

        uint amount = token.balanceOf(address(this));

        require(token.transfer(msg.sender, amount));

        emit UnsoldTokenReturned(msg.sender, amount);
    }

    function stagesLength() external view returns (uint) {
        return stages.length;
    }

    function milestonesLength() external view returns (uint) {
        return milestones.length;
    }

    function getEndDate() external view returns (uint32) {
        require(stages.length > 0);

        return stages[stages.length - 1].endDate;
    }

    function getWToken() external view returns (IWToken) {
        return token;
    }

    function getFund() external view returns (IW12Fund) {
        return fund;
    }

    function getPaymentMethodsList() external view returns (bytes32[]) {
        return paymentMethods.list();
    }

    function isPaymentMethodAllowed(bytes32 _method) external view returns (bool) {
        return paymentMethods.isAllowed(_method);
    }

    function getInvoice(bytes32 method, uint amount) public view returns (uint[5]) {
        require(paymentMethods.isAllowed(method));

        (uint index, bool found) = getCurrentStageIndex();

        if (!found) return;

        if (PurchaseProcessing.METHOD_ETH() != method) {
            if (!rates.isToken(method)) {
                return;
            }
        }

        uint[5] memory lastArguments = _getInvoiceLastArguments(method);

        return PurchaseProcessing.invoice(
            method,
            amount,
            stages[index].discount,
            stages[index].volumeBoundaries,
            stages[index].volumeBonuses,
            lastArguments[0],
            lastArguments[1],
            lastArguments[2],
            lastArguments[3],
            lastArguments[4]
        );
    }

    function addAdmin(address _account) public onlyAdmin {
        _addAdmin(_account);
    }

    function removeAdmin(address _account) public onlyAdmin {
        _removeAdmin(_account);
    }

    function addProjectOwner(address _account) public onlyAdmin {
        _addProjectOwner(_account);
    }

    function removeProjectOwner(address _account) public onlyAdmin {
        _removeProjectOwner(_account);
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

    /**
     * @dev Returns index of active milestone or last milestone
     */
    function getCurrentMilestoneIndex() public view returns(uint index, bool found) {
        if (milestones.length == 0 || !isEnded()) return;

        found = true;

        // from withdrawalWindow begins next milestone
        while (index < milestones.length - 1 && now >= milestones[index].withdrawalWindow) {
            index++;
        }
    }

    function getLastMilestoneIndex() public view returns(uint index, bool found) {
        if (milestones.length == 0 || !isEnded()) return;

        found = true;
        index = milestones.length - 1;
    }

    function updatePurchaseFeeParameterForPaymentMethod(bytes32 method, bool has, uint value) public onlyAdmin {
        require(value.isPercent() && value < Percent.MAX());
        paymentMethodsPurchaseFee[method].has = has;
        paymentMethodsPurchaseFee[method].value = value;
    }

    function getPurchaseFeeParameterForPaymentMethod(bytes32 method) public view returns(bool, uint) {
        return (paymentMethodsPurchaseFee[method].has, paymentMethodsPurchaseFee[method].value);
    }

    function getPurchaseFeeForPaymentMethod(bytes32 method) public view returns(uint) {
        if (paymentMethodsPurchaseFee[method].has) {
            return paymentMethodsPurchaseFee[method].value;
        }
        return serviceFee;
    }

    function getFee(uint tokenAmount, uint cost, bytes32 method) public view returns (uint[2]) {
        require(paymentMethods.isAllowed(method));
        return PurchaseProcessing.fee(tokenAmount, cost, WTokenSaleFeePercent, getPurchaseFeeForPaymentMethod(method));
    }

    function getSaleVolumeBonus(uint value) public view returns (uint bonus) {
        (uint index, bool found) = getCurrentStageIndex();

        if (!found) return;

        Crowdsale.Stage storage stage = stages[index];

        return PurchaseProcessing.getBonus(value, stage.volumeBoundaries, stage.volumeBonuses);
    }

    function getCurrentStageIndex() public view returns (uint index, bool found) {
        for (uint i = 0; i < stages.length; i++) {
            Crowdsale.Stage storage stage = stages[i];

            if (stage.startDate <= now && stage.endDate > now) {
                return (i, true);
            }
        }

        return (0, false);
    }

    function buyTokens(bytes32 method, uint amount) public payable nonReentrant onlyWhenSaleActive {
        require(paymentMethods.isAllowed(method));

        if (PurchaseProcessing.METHOD_ETH() != method) {
            require(rates.getTokenAddress(method) != address(0));
        }

        (uint index, /*bool found*/) = getCurrentStageIndex();

        uint[5] memory invoice = getInvoice(method, amount);
        uint[2] memory fee = getFee(invoice[0], invoice[1], method);

        _transferFee(fee, method);
        _transferPurchase(invoice, fee, stages[index].vesting, method);
        _recordPurchase(invoice, fee, method);

        emit TokenPurchase(msg.sender, invoice[0], invoice[1], invoice[3]);
    }

    function getInvoiceByTokenAmount(bytes32 method, uint tokenAmount) public view returns (uint[4]) {
        require(paymentMethods.isAllowed(method));

        (uint index, bool found) = getCurrentStageIndex();

        if (!found) return;

        if (PurchaseProcessing.METHOD_ETH() != method) {
            if (!rates.isToken(method)) {
                return;
            }
        }

        uint[5] memory lastArguments = _getInvoiceByTokenAmountLastArguments(method);

        return PurchaseProcessing.invoiceByTokenAmount(
            method,
            tokenAmount,
            stages[index].discount,
            stages[index].volumeBoundaries,
            stages[index].volumeBonuses,
            lastArguments[0],
            lastArguments[1],
            lastArguments[2],
            lastArguments[3],
            lastArguments[4]
        );
    }

    function isEnded() public view returns (bool) {
        return stages.length == 0 || stages[stages.length - 1].endDate < now;
    }

    function isSaleActive() public view returns (bool) {
        (, bool found) = getCurrentStageIndex();

        return found;
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
        Crowdsale.setStages(stages, milestones, parameters, bonusConditions);

        emit StagesUpdated();
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
        Crowdsale.setMilestones(stages, milestones, parameters, offsets, namesAndDescriptions);

        emit MilestonesUpdated();
    }

    function __setParameters(uint _price, address _serviceWallet) internal {
        require(_price > 0);
        require(_serviceWallet != address(0));

        price = _price;
        serviceWallet = _serviceWallet;
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
            rates.isToken(method) ? address(rates.getTokenAddress(method)) : address(0),
            address(token)
        );
    }

    function _recordPurchase(uint[5] _invoice, uint[2] _fee, bytes32 method) internal {
        if (method == PurchaseProcessing.METHOD_ETH()) {
            fund.recordPurchase.value(_invoice[1].sub(_fee[1]))(
                msg.sender, _invoice[0], method, _invoice[1].sub(_fee[1]), _invoice[2]);
        } else {
            require(IERC20(rates.getTokenAddress(method)).transfer(address(fund), _invoice[1].sub(_fee[1])));
            fund.recordPurchase(msg.sender, _invoice[0], method, _invoice[1].sub(_fee[1]), _invoice[2]);
        }
    }

    function _getInvoiceLastArguments(bytes32 method) internal view returns(uint[5] result) {
        result[0] = rates.get(method);
        result[1] = price;
        result[2] = uint(token.decimals());
        result[3] = PurchaseProcessing.METHOD_ETH() == method
            ? 18
            : uint(ERC20Detailed(rates.getTokenAddress(method)).decimals());
        result[4] = token.balanceOf(address(this));
    }

    function _getInvoiceByTokenAmountLastArguments(bytes32 method) internal view returns (uint[5] result) {
        result[0] = rates.get(method);
        result[1] = price;
        result[2] = uint(token.decimals());
        result[3] = PurchaseProcessing.METHOD_ETH() == method
            ? 18
            : uint(ERC20Detailed(rates.getTokenAddress(method)).decimals());
        result[4] = token.balanceOf(address(this));
    }


    function getProjectType() public view returns(uint8)
    {
        return project_type;
    }


    function setProjectType(uint8 val_type) public onlyAdmin
    {
        project_type = val_type;
    }


    function getProjectName() public view returns(string)
    {
        return project_name;
    }


    function setProjectName(string val_name) public onlyAdmin
    {
        project_name = val_name;
    }


    function getRefundDate() public view returns(uint)
    {
        return refund_date;
    }


    function setRefundDate(uint val) public onlyAdmin
    {
        refund_date = val;
    }




    modifier beforeSaleStart() {
        if (stages.length > 0) {
            require(stages[0].startDate > now);
        }

        _;
    }

    modifier onlyWhenSaleActive() {
        require(isSaleActive());

        _;
    }
}
