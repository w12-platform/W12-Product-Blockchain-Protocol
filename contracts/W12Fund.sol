pragma solidity ^0.4.24;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "../openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WToken.sol";
import "./IW12Crowdsale.sol";


contract W12Fund is Ownable, ReentrancyGuard {
    using SafeMath for uint;

    IW12Crowdsale public crowdsale;
    address public swap;
    WToken public wToken;
    mapping (address=>TokenPriceInfo) public buyers;
    mapping (uint32 => bool) public completedTranches;
    uint public totalFunded;
    uint public totalRefunded;

    struct TokenPriceInfo {
        uint totalBought;
        uint averagePrice;
        uint totalFunded;
    }

    event FundsReceived(address indexed buyer, uint etherAmount, uint tokenAmount);
    event FundsRefunded(address indexed buyer, uint etherAmount, uint tokenAmount);
    event TrancheOperation(address indexed receiver, uint amount);

    function setCrowdsale(IW12Crowdsale _crowdsale) onlyOwner external {
        require(_crowdsale != address(0));

        crowdsale = _crowdsale;
        wToken = _crowdsale.getWToken();
    }

    function setSwap(address _swap) onlyOwner external {
        require(_swap != address(0));

        swap = _swap;
    }

    function recordPurchase(address buyer, uint tokenAmount) external payable onlyFrom(crowdsale) {
        uint tokensBoughtBefore = buyers[buyer].totalBought;

        buyers[buyer].totalBought = tokensBoughtBefore.add(tokenAmount);
        buyers[buyer].totalFunded = buyers[buyer].totalFunded.add(msg.value);
        buyers[buyer].averagePrice = buyers[buyer].totalFunded.div(buyers[buyer].totalBought);

        totalFunded += msg.value;

        emit FundsReceived(buyer, msg.value, tokenAmount);
    }

    function getInvestmentsInfo(address buyer) external view returns (uint totalTokensBought, uint averageTokenPrice) {
        require(buyer != address(0));

        return (buyers[buyer].totalBought, buyers[buyer].averagePrice);
    }

    /**
        calculation parameters:

            a = address(this).balance
            b = totalFunded
            c = buyers[buyer].totalFunded
            d = buyers[buyer].totalBought
            e = wtokensToRefund

        formula:
            ( ( c * (a / b) ) / d ) * e = (refund amount)

        adapted:
            1. c * b / a = A_1
            2. A_1 * 10 ** 8 / d * e / 10 ** 8
    */
    function getRefundAmount(uint wtokensToRefund) public view returns (uint) {
        uint result = 0;
        uint max = uint(-1) / 10 ** 8;
        address buyer = msg.sender;
        (uint32 start, uint32 end) = getRefundPeriod();

        if (
            start > 0
            && end >= now
            && start < now
            && wtokensToRefund > 0
            && buyers[buyer].totalBought > 0
            && address(this).balance > 0
            && wToken.balanceOf(buyer) >= wtokensToRefund
            && buyers[buyer].totalBought >= wtokensToRefund
        ) {
            uint allowedFund = buyers[buyer].totalFunded.mul(totalFunded).div(address(this).balance);
            uint precisionComponent = allowedFund >= max ? 1 : 10 ** 8;

            result = result.add(
                allowedFund
                    .mul(precisionComponent)
                    .div(buyers[buyer].totalBought)
                    .mul(wtokensToRefund)
                    .div(precisionComponent)
            );
        }

        return result;
    }

    function getRefundPeriod() public view returns (uint32, uint32) {
        (,, uint32 voteEndDate, uint32 withdrawalWindow,,) = crowdsale.getCurrentMilestone();

        return (voteEndDate, withdrawalWindow);
    }

    function getTrancheAmount() public view returns (uint) {
        uint result = 0;
        (uint8 tranchePercent, uint32 start, uint32 end) = getTrancheParameters();
        
        bool completed = completedTranches[end];

        bool completed = completedTranches[end];

        if (
            !completed
            && start > 0
            && end >= now
            && start < now
            && tranchePercent > 0
            && address(this).balance > 0
        ) {
            uint allowedFund = totalFunded.sub(totalRefunded);

            result = result.add(
                allowedFund
                .mul(tranchePercent)
                .div(100)
            );
        }

        return result;
    }

    function getTrancheParameters() public view returns (uint8, uint32, uint32) {
        (, uint8 tranchePercent, uint32 voteEndDate, uint32 withdrawalWindow,,) = crowdsale.getCurrentMilestone();

        bool completed = completedTranches[withdrawalWindow];

        if (completed) {
            return (0, 0, 0);
        }

        return (
            tranchePercent,
            voteEndDate,
            withdrawalWindow < now && withdrawalWindow > 0
                ? uint32(-1)
                : withdrawalWindow
        );
    }

    function tranche() external onlyOwner nonReentrant {
        uint trancheAmount = getTrancheAmount();
        (,, uint32 withdrawalWindow) = getTrancheParameters();

        require(trancheAmount > 0);

        completedTranches[withdrawalWindow] = true;

        msg.sender.transfer(trancheAmount);

        emit TrancheOperation(msg.sender, trancheAmount);
    }

    function refund(uint wtokensToRefund) external nonReentrant {
        uint transferAmount = getRefundAmount(wtokensToRefund);
        address buyer = msg.sender;

        require(transferAmount > 0);
        require(wToken.transferFrom(buyer, swap, wtokensToRefund));

        buyers[buyer].totalBought = buyers[buyer].totalBought.sub(wtokensToRefund);
        buyers[buyer].totalFunded = buyers[buyer].totalFunded.sub(wtokensToRefund.mul(buyers[buyer].averagePrice));
        buyers[buyer].averagePrice = buyers[buyer].totalFunded > 0 && buyers[buyer].totalBought > 0
            ? buyers[buyer].totalFunded.div(buyers[buyer].totalBought)
            : 0;

        // update total refunded amount counter
        totalRefunded = totalRefunded.add(transferAmount);

        buyer.transfer(transferAmount);

        emit FundsRefunded(buyer, transferAmount, wtokensToRefund);
    }

    modifier onlyFrom(address sender) {
        require(msg.sender == sender);

        _;
    }
}
