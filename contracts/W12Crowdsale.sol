pragma solidity ^0.4.24;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "../openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WToken.sol";
import "./IW12Crowdsale.sol";


contract W12Crowdsale is IW12Crowdsale, Ownable, ReentrancyGuard {
    using SafeMath for uint;

    struct Stage {
        uint32 endDate;
        uint8 discount;
        uint32 vesting;
    }

    Stage[] public stages;
    WToken public token;
    uint32 public startDate;
    uint public price;
    uint8 public serviceFee;
    address public serviceWallet;

    constructor (address _token, uint32 _startDate, uint _price, address _serviceWallet, uint8 _serviceFee) public {
        require(_token != address(0x0));

        token = WToken(_token);

        setParameters(_startDate, _price, _serviceWallet, _serviceFee);
    }

    function setParameters(uint32 _startDate, uint _price, address _serviceWallet, uint8 _serviceFee) onlyOwner public {
        require(_startDate >= now);
        require(_price > 0);
        require(_serviceWallet != address(0x0));
        require(_serviceFee >= 0 && _serviceFee < 100);

        startDate = _startDate;
        price = _price;
        serviceWallet = _serviceWallet;
        serviceFee = _serviceFee;
    }

    function setStages(uint32[] stage_endDates, uint8[] stage_discounts, uint32[] stage_vestings) onlyOwner external {
        require(stage_endDates.length > 0);
        require(stage_endDates.length == stage_discounts.length);
        require(stage_vestings.length == stage_discounts.length);

        stages.length = stage_endDates.length;

        for(uint8 i = 0; i < stage_endDates.length; i++) {
            require(stage_discounts[i] >= 0 && stage_discounts[i] < 100);
            // Checking that stages entered in historical order
            if(i < stage_endDates.length - 1)
                require(stage_endDates[i] < stage_endDates[i+1]);


            // Reverting stage order for future use
            stages[stage_endDates.length - i - 1].endDate = stage_endDates[i];
            stages[stage_endDates.length - i - 1].discount = stage_discounts[i];
            stages[stage_endDates.length - i - 1].vesting = stage_vestings[i];
        }
    }

    function buyTokens() payable nonReentrant public {
        require(msg.value > 0);
        require(startDate <= now);

        (uint32 endDate, uint8 discount, uint32 vesting) = getCurrentStage();

        uint stagePrice = discount > 0 ? price.mul(discount).div(100) : price;

        uint tokenAmount = msg.value.div(stagePrice);
        require(token.vestingTransfer(msg.sender, tokenAmount, vesting));

        if(serviceFee > 0)
            serviceWallet.transfer(msg.value.mul(serviceFee).div(100));
    }

    function getCurrentStage() public returns(uint32 endDate, uint8 discount, uint32 vesting) {
        if(stages.length == 0)
            return (uint32(-1), 0, 0);

        if(stages[stages.length].endDate >= now)
            return (stages[stages.length].endDate, stages[stages.length].discount, stages[stages.length].vesting);

        stages.length--;
        return getCurrentStage();
    }

    function () payable external {
        buyTokens();
    }
}
