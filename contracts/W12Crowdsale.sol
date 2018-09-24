pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IW12Crowdsale.sol";
import "./interfaces/IW12Fund.sol";
import "./libs/Percent.sol";
import "./versioning/Versionable.sol";

contract W12Crowdsale is Versionable, IW12Crowdsale, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using Percent for uint;
    using BytesLib for bytes;

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
        uint  tranchePercent;
        uint32 voteEndDate;
        uint32 withdrawalWindow;
        bytes name;
        bytes description;
    }

    WToken public token;
    ERC20 public originToken;
    uint public price;
    uint public serviceFee;
    uint public WTokenSaleFeePercent;
    address public serviceWallet;
    address public swap;
    IW12Fund public fund;

    Stage[] public stages;
    Milestone[] public milestones;
    uint32[] public milestoneDates;

    event TokenPurchase(address indexed buyer, uint amountPaid, uint tokensBought, uint change);
    event StagesUpdated();
    event StageUpdated(uint index);
    event MilestonesUpdated();
    event UnsoldTokenReturned(address indexed owner, uint amount);

    event debug(uint value);

    constructor (
        uint version,
        address _originToken,
        address _token,
        uint _price,
        address _serviceWallet,
        address _swap,
        uint _serviceFee,
        uint _WTokenSaleFeePercent,
        IW12Fund _fund
    )
        Versionable(version) public
    {
        require(_token != address(0));
        require(_serviceFee.isPercent() && _serviceFee.fromPercent() < 100);
        require(_WTokenSaleFeePercent.isPercent() && _WTokenSaleFeePercent.fromPercent() < 100);
        require(_fund != address(0));
        require(_swap != address(0));

        token = WToken(_token);
        originToken = ERC20(_originToken);

        __setParameters(_price, _serviceWallet);
        serviceFee = _serviceFee;
        swap = _swap;
        WTokenSaleFeePercent = _WTokenSaleFeePercent;
        fund = _fund;
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

    function getStageVolumeBoundaries(uint stageNumber) external view returns (uint[]) {
        return stages[stageNumber].volumeBoundaries;
    }

    function getStageVolumeBonuses(uint stageNumber) external view returns (uint[]) {
        return stages[stageNumber].volumeBonuses;
    }

    function getEndDate() external view returns (uint32) {
        require(stages.length > 0);

        return stages[stages.length - 1].endDate;
    }

    // returns last milestone index if completely ended or active milestone at now
    function getCurrentMilestoneIndex() public view returns (uint index, bool found) {
        uint milestonesCount = milestones.length;

        if(milestonesCount == 0 || !isEnded()) return;

        found = true;

        // from withdrawalWindow begins next milestone
        while(index < milestonesCount - 1 && now >= milestoneDates[(index + 1) * 3 - 1])
            index++;
    }

    function getLastMilestoneIndex() public view returns (uint index, bool found) {
        uint milestonesCount = milestones.length;

        if (milestonesCount == 0 || !isEnded()) return;

        found = true;
        index = milestonesCount - 1;
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

    function setStages(uint32[2][] dates, uint[] stage_discounts, uint32[] stage_vestings) external onlyOwner beforeSaleStart {
        require(dates.length <= uint8(-1));
        require(dates.length > 0);
        require(dates.length == stage_discounts.length);
        require(dates.length == stage_vestings.length);

        if (milestones.length > 0) {
            require(milestones[0].endDate > dates[dates.length - 1][1], "Last stage endDate must be less than first milestone endDate");
        }

        uint8 stagesCount = uint8(dates.length);

        delete stages;

        for(uint8 i = 0; i < stagesCount; i++) {
            require(stage_discounts[i].isPercent() && stage_discounts[i].fromPercent() < 100, "Stage discount is not in allowed range [0, 99.99)");
            require(dates[i][0] > now);
            require(dates[i][0] < dates[i][1], "Stage start date must be gt end date");

            if (i > 0) {
                require(dates[i - 1][1] <= dates[i][0], "Stages are not in historical order");
            }

            stages.push(Stage({
                startDate: dates[i][0],
                endDate: dates[i][1],
                discount: stage_discounts[i],
                vesting: stage_vestings[i],
                volumeBoundaries: new uint[](0),
                volumeBonuses: new uint[](0)
            }));
        }

        emit StagesUpdated();
    }

    function setStageVolumeBonuses(uint stage, uint[] volumeBoundaries, uint[] volumeBonuses) external onlyOwner beforeSaleStart {
        require(volumeBoundaries.length == volumeBonuses.length);
        require(stage < stages.length);

        for(uint i = 0; i < volumeBoundaries.length; i++) {
            require(volumeBonuses[i].isPercent() && volumeBonuses[i].fromPercent() < 100, "Bonus percent is not in allowed range [0, 99.99)");

            if (i > 0) {
                require(volumeBoundaries[i - 1] < volumeBoundaries[i], "Volume boundaries must be in ascending order");
            }
        }

        delete stages[stage].volumeBoundaries;
        delete stages[stage].volumeBonuses;

        stages[stage].volumeBoundaries = volumeBoundaries;
        stages[stage].volumeBonuses = volumeBonuses;

        emit StageUpdated(stage);
    }

    function setMilestones(
        uint32[] dates,
        uint[] tranchePercents,
        uint32[] offsets,
        bytes namesAndDescriptions
    )
        external onlyOwner beforeSaleStart
    {
        require(dates.length <= uint8(- 1));
        require(dates.length >= 3);
        require(dates.length % 3 == 0);
        require(tranchePercents.length.mul(2) == offsets.length);
        require(tranchePercents.length.mul(3) == dates.length);
        require(namesAndDescriptions.length >= tranchePercents.length * 2);

        if (stages.length > 0) {
            require(
                stages[stages.length - 1].endDate < dates[0],
                "First milestone endDate must be greater than last stage endDate"
            );
        }

        delete milestones;
        delete milestoneDates;

        milestoneDates = dates;

        uint offset = 0;
        uint totalPercents = 0;

        for(uint8 i = 0; i < uint8(dates.length); i += 3) {
            bytes memory name = namesAndDescriptions.slice(offset, offsets[i / 3 * 2]);
            bytes memory description = namesAndDescriptions.slice(offset + offsets[i / 3 * 2], offsets[i / 3 * 2 + 1]);

            require(dates[i] > now);
            require(dates[i + 1] > dates[i]);
            require(dates[i + 2] > dates[i + 1]);
            require(name.length > 0);
            require(description.length > 0);
            require(
                tranchePercents[i / 3].isPercent(),
                "Tranche percent is not in allowed range [0, 100)"
            );

            if (i > 0) {
                require(dates[i - 1] < dates[i], "Milestone dates is not in ascending order");
            }

            milestones.push(Milestone({
                endDate: dates[i],
                tranchePercent: tranchePercents[i / 3],
                voteEndDate: dates[i + 1],
                withdrawalWindow: dates[i + 2],
                name: name,
                description: description
            }));

            offset += offsets[i / 3] + offsets[i / 3 + 1];
            totalPercents += tranchePercents[i / 3];
        }

        require(totalPercents == Percent.MAX());

        emit MilestonesUpdated();
    }

    function buyTokens() payable public nonReentrant onlyWhenSaleActive {
        require(msg.value > 0);

        (uint index, ) = getCurrentStageIndex();

        uint discount = stages[index].discount;
        uint32 vesting = stages[index].vesting;
        uint volumeBonus = getSaleVolumeBonus(msg.value);

        (uint tokenAmount, uint weiCost, uint change, ) = _purchaseOrder(msg.value, discount, volumeBonus);

        if (WTokenSaleFeePercent > 0) {
            uint tokensFee = tokenAmount.percent(WTokenSaleFeePercent);

            require(originToken.transferFrom(swap, serviceWallet, tokensFee));
            require(token.transfer(swap, tokensFee));
        }

        require(token.vestingTransfer(msg.sender, tokenAmount, vesting));

        if (change > 0) {
            msg.sender.transfer(change);
        }

        if(serviceFee > 0)
            serviceWallet.transfer(weiCost.percent(serviceFee));

        fund.recordPurchase.value(address(this).balance).gas(100000)(msg.sender, tokenAmount);

        emit TokenPurchase(msg.sender, weiCost, tokenAmount, change);
    }

    function _purchaseOrder(uint _wei, uint discount, uint volumeBonus)
        internal view returns (uint tokens, uint weiCost, uint change, uint actualPrice)
    {
        weiCost = _wei;

        uint balance = token.balanceOf(address(this));

        require(balance >= 10 ** uint(token.decimals()));

        actualPrice = discount > 0
            ? price.percent(Percent.MAX() - discount)
            : price;

        tokens = _wei
            .mul(Percent.MAX() + volumeBonus)
            .mul(10 ** uint(token.decimals()))
            .div(actualPrice)
            .div(Percent.MAX());

        if (balance < tokens) {
            weiCost = _wei
                .mul(balance)
                .div(tokens);
            change = _wei - weiCost;
            tokens = balance;
        }
    }

    function getWToken() external view returns(WToken) {
        return token;
    }

    function getFund() external view returns(IW12Fund) {
        return fund;
    }

    function getSaleVolumeBonus(uint value) public view returns(uint bonus) {
        (uint index, bool found) = getCurrentStageIndex();

        if (!found) return 0;

        Stage storage stage = stages[index];

        for(uint i = 0; i < stage.volumeBoundaries.length; i++) {
            if (value >= stage.volumeBoundaries[i]) {
                bonus = stage.volumeBonuses[i];
            } else {
                break;
            }
        }
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

    function() payable external {
        buyTokens();
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
