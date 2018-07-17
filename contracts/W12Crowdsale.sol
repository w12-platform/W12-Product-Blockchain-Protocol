pragma solidity ^0.4.24;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "../openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WToken.sol";
import "./IW12Crowdsale.sol";
import "./W12Fund.sol";


contract W12Crowdsale is IW12Crowdsale, Ownable, ReentrancyGuard {
    using SafeMath for uint;

    struct Stage {
        uint32 endDate;
        uint8 discount;
        uint32 vesting;
        uint[] volumeBoundaries;
        uint8[] volumeBonuses;
    }

    struct Milestone {
        uint32 endDate;
        uint8 tranchePercent;
        uint32 voteEndDate;
    }

    WToken public token;
    uint32 public startDate;
    uint public price;
    uint8 public serviceFee;
    address public serviceWallet;
    W12Fund public fund;

    Stage[] public stages;
    Milestone[] public milestones;

    event TokenPurchase(address indexed buyer, uint amountPaid, uint tokensBought);
    event StagesUpdated();

    constructor (address _token, uint32 _startDate, uint _price, address _serviceWallet, uint8 _serviceFee, W12Fund _fund) public {
        require(_token != address(0));
        require(_serviceFee >= 0 && _serviceFee < 100);
        require(_fund != address(0));

        token = WToken(_token);

        __setParameters(_startDate, _price, _serviceWallet);
        serviceFee = _serviceFee;
        fund = _fund;
    }

    function stagesLength() external view returns (uint) {
        return stages.length;
    }

    function milestonesLength() external view returns (uint) {
        return milestones.length;
    }

    function getStageVolumeBoundaries(uint stageNumber) external view returns (uint[]) {
        return stages[stageNumber].volumeBoundaries;
    }

    function getStageVolumeBonuses(uint stageNumber) external view returns (uint8[]) {
        return stages[stageNumber].volumeBonuses;
    }

    function __setParameters(uint32 _startDate, uint _price, address _serviceWallet) internal {
        require(_startDate >= now);
        require(_price > 0);
        require(_serviceWallet != address(0));

        startDate = _startDate;
        price = _price;
        serviceWallet = _serviceWallet;
    }

    function setParameters(uint32 _startDate, uint _price, address _serviceWallet) external onlyOwner {
        __setParameters(_startDate, _price, _serviceWallet);
    }

    function setStages(uint32[] stage_endDates, uint8[] stage_discounts, uint32[] stage_vestings) external onlyOwner {
        require(stage_endDates.length <= uint8(-1));
        require(stage_endDates.length > 0);
        require(stage_endDates.length == stage_discounts.length);
        require(stage_endDates.length == stage_vestings.length);

        uint8 stagesCount = uint8(stage_endDates.length);
        stages.length = stagesCount;

        for(uint8 i = 0; i < stagesCount; i++) {
            require(stage_discounts[i] >= 0 && stage_discounts[i] < 100);
            require(startDate < stage_endDates[i]);
            // Checking that stages entered in historical order
            if(i < stagesCount - 1)
                require(stage_endDates[i] < stage_endDates[i+1], "Stages are not in historical order");

            // Reverting stage order for future use
            stages[stagesCount - i - 1].endDate = stage_endDates[i];
            stages[stagesCount - i - 1].discount = stage_discounts[i];
            stages[stagesCount - i - 1].vesting = stage_vestings[i];
        }

        emit StagesUpdated();
    }

    function setStageVolumeBonuses(uint stage, uint[] volumeBoundaries, uint8[] volumeBonuses) external onlyOwner {
        require(volumeBoundaries.length == volumeBonuses.length);
        require(stage < stages.length);

        stages[stage].volumeBoundaries = volumeBoundaries;
        stages[stage].volumeBonuses = volumeBonuses;
    }

    function setMilestones(uint32[] endDates, uint8[] tranchePercents, uint32[] voteEndDates) external onlyOwner {
        require(endDates.length <= uint8(-1));
        require(endDates.length > 0);
        require(endDates.length == tranchePercents.length);
        require(endDates.length == voteEndDates.length);

        uint8 length = uint8(endDates.length);
        delete milestones;

        for(uint8 i = 0; i < length; i++)
            milestones.push(Milestone({
                endDate: endDates[i],
                tranchePercent: tranchePercents[i],
                voteEndDate: voteEndDates[i]
            }));
    }

    function buyTokens() payable nonReentrant public {
        require(msg.value > 0);
        require(startDate <= now);
        require(stages.length > 0);

        (uint8 discount, uint32 vesting, uint8 volumeBonus) = getCurrentStage();

        uint stagePrice = discount > 0 ? price.mul(100 - discount).div(100) : price;

        uint tokenAmount = msg.value
            .mul(100 + volumeBonus)
            .div(stagePrice)
            .div(100);

        require(token.vestingTransfer(msg.sender, tokenAmount, vesting));

        if(serviceFee > 0)
            serviceWallet.transfer(msg.value.mul(serviceFee).div(100));

        fund.recordPurchase.value(address(this).balance).gas(100000)(msg.sender, tokenAmount);

        emit TokenPurchase(msg.sender, msg.value, tokenAmount);
    }

    function getWToken() external view returns(WToken) {
        return token;
    }

    function getCurrentStage() internal returns(uint8 discount, uint32 vesting, uint8 volumeBonus) {
        if(stages.length == 0)
            return (0, 0, 0);

        Stage storage lastStage = stages[stages.length - 1];

        if(lastStage.endDate >= now) {
            volumeBonus = 0;
            uint lastLowerBoundary = 0;

            if(lastStage.volumeBoundaries.length > 0)
                for (uint i = 0; i < lastStage.volumeBoundaries.length - 1; i++)
                    if(msg.value >= lastLowerBoundary && msg.value < lastStage.volumeBoundaries[i]) {
                        volumeBonus = lastStage.volumeBonuses[i];
                        break;
                    }
                    else
                        lastLowerBoundary = lastStage.volumeBoundaries[i];

            return (lastStage.discount, lastStage.vesting, volumeBonus);
        }

        stages.length--;
        return getCurrentStage();
    }

    function () payable external {
        buyTokens();
    }

    function claimRemainingTokens() external onlyOwner {
        require(stages.length == 0);

        require(token.transfer(owner, token.balanceOf(address(this))));
    }
}
