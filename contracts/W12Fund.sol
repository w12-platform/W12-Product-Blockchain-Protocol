pragma solidity ^0.4.24;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "../openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WToken.sol";
import "./interfaces/IW12Crowdsale.sol";
import "./interfaces/IW12Fund.sol";
import "./libs/Percent.sol";


contract W12Fund is IW12Fund, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using Percent for uint;

    IW12Crowdsale public crowdsale;
    address public swap;
    address public serviceWallet;
    WToken public wToken;
    uint public tokenDecimals; // TODO: refactor this
    mapping (address=>TokenPriceInfo) public buyers;
    mapping (uint => bool) public completedTranches; // TODO: refactor this
    uint public totalFunded;
    uint public totalRefunded;
    uint public totalTranchePercentReleased;
    uint public trancheFeePercent;

    struct TokenPriceInfo {
        uint totalBought;
        uint averagePrice;
        uint totalFunded;
    }

    event FundsReceived(address indexed buyer, uint weiAmount, uint tokenAmount);
    event FundsRefunded(address indexed buyer, uint weiAmount, uint tokenAmount);
    event TrancheReleased(address indexed receiver, uint amount);

    constructor(uint _trancheFeePercent) public {
        require(_trancheFeePercent.isPercent() && _trancheFeePercent.fromPercent() < 100);

        trancheFeePercent = _trancheFeePercent;
    }

    function setCrowdsale(IW12Crowdsale _crowdsale) onlyOwner external {
        require(_crowdsale != address(0));

        crowdsale = _crowdsale;
        wToken = _crowdsale.getWToken();
        tokenDecimals = wToken.decimals();
    }

    function setSwap(address _swap) onlyOwner external {
        require(_swap != address(0));

        swap = _swap;
    }

    function setServiceWallet(address _serviceWallet) onlyOwner external {
        require(_serviceWallet != address(0));

        serviceWallet = _serviceWallet;
    }

    function recordPurchase(address buyer, uint tokenAmount) external payable onlyFrom(crowdsale) {
        buyers[buyer].totalBought = buyers[buyer].totalBought.add(tokenAmount);
        buyers[buyer].totalFunded = buyers[buyer].totalFunded.add(msg.value);
        buyers[buyer].averagePrice = (buyers[buyer].totalFunded.mul(10 ** tokenDecimals)).div(buyers[buyer].totalBought);

        totalFunded = totalFunded.add(msg.value);

        emit FundsReceived(buyer, msg.value, tokenAmount);
    }

    function getInvestmentsInfo(address buyer) external view returns (uint totalTokensBought, uint averageTokenPrice) {
        require(buyer != address(0));

        return (buyers[buyer].totalBought, buyers[buyer].averagePrice);
    }

    /**
        a = address(this).balance
        b = totalFunded
        c = buyers[buyer].totalFunded
        d = buyers[buyer].totalBought
        e = wtokensToRefund

        ( ( c * (a / b) ) / d ) * e = (refund amount)
    */
    function getRefundAmount(uint wtokensToRefund) public view returns (uint result) {
        uint max = uint(-1) / 10 ** (tokenDecimals + 8);
        address buyer = msg.sender;

        if(wtokensToRefund == 0
            || buyers[buyer].totalBought == 0
            || address(this).balance == 0
            || wToken.balanceOf(buyer) < wtokensToRefund
            || buyers[buyer].totalBought < wtokensToRefund
        ) return;

        uint allowedFund = buyers[buyer].totalFunded.mul(totalFunded).div(address(this).balance);
        uint precisionComponent = allowedFund >= max ? 1 : 10 ** (tokenDecimals + 8);

        result = result.add(
            allowedFund
                .mul(precisionComponent)
                .div(buyers[buyer].totalBought)
                .mul(wtokensToRefund)
                .div(precisionComponent)
        );
    }

    function getTrancheAmount() public view returns (uint result) {
        (uint tranchePercent, uint totalTranchePercentBefore, ) = getTrancheParameters();

        if (
            tranchePercent == 0 && totalTranchePercentBefore == 0
            || address(this).balance == 0
        ) return;

        uint allowedFund = totalFunded.sub(totalRefunded);
        uint trancheToRelease = tranchePercent + totalTranchePercentBefore - totalTranchePercentReleased;

        result = allowedFund.percent(trancheToRelease);
    }

    function getTrancheParameters() public view returns (uint, uint totalTranchePercentBefore, uint) {
        (uint index, bool found) = crowdsale.getCurrentMilestoneIndex();
        (uint lastIndex, ) = crowdsale.getLastMilestoneIndex();
        (,,, uint32 lastWithdrawalWindow,,) = crowdsale.getMilestone(lastIndex);

        if (!found || !trancheTransferAllowed()) return;

        // get percent from prev milestone
        index = index == 0 || now >= lastWithdrawalWindow ? index : index - 1;

        ( , uint tranchePercent, , uint32 withdrawalWindow, , ) = crowdsale.getMilestone(index);

        bool completed = completedTranches[index];

        if (completed) return;

        uint dIndex = index;

        while (dIndex > 0) {
            dIndex--;

            (, uint _tranchePercent, , , , ) = crowdsale.getMilestone(dIndex);

            totalTranchePercentBefore += _tranchePercent;
        }

        return (
            tranchePercent,
            // it will helps to calculate tranche
            totalTranchePercentBefore,
            index
        );
    }

    function tranche() external onlyOwner nonReentrant {
        require(trancheTransferAllowed());

        uint trancheAmount = getTrancheAmount();
        (uint tranchePercent, ,uint milestoneIndex) = getTrancheParameters();

        require(trancheAmount > 0);

        completedTranches[milestoneIndex] = true;

        if (trancheFeePercent > 0) {
            uint fee = trancheAmount.percent(trancheFeePercent);

            serviceWallet.transfer(fee);

            trancheAmount = trancheAmount.sub(fee);
        }

        msg.sender.transfer(trancheAmount);

        totalTranchePercentReleased += tranchePercent;

        emit TrancheReleased(msg.sender, trancheAmount);
    }

    function refund(uint wtokensToRefund) external nonReentrant {
        address buyer = msg.sender;

        require(refundAllowed());
        require(wtokensToRefund > 0);
        require(buyers[buyer].totalBought >= wtokensToRefund);
        require(wToken.balanceOf(buyer) >= wtokensToRefund);
        require(wToken.allowance(msg.sender, address(this)) >= wtokensToRefund);

        uint transferAmount = getRefundAmount(wtokensToRefund);

        require(transferAmount > 0);
        require(wToken.transferFrom(buyer, swap, wtokensToRefund));

        buyers[buyer].totalBought = buyers[buyer].totalBought
            .sub(wtokensToRefund);
        buyers[buyer].totalFunded = buyers[buyer].totalFunded
            .sub(wtokensToRefund.mul(buyers[buyer].averagePrice).div(10 ** tokenDecimals));

        // update total refunded amount counter
        totalRefunded = totalRefunded.add(transferAmount);

        buyer.transfer(transferAmount);

        emit FundsRefunded(buyer, transferAmount, wtokensToRefund);
    }

    function refundAllowed() public view returns (bool) {
        (uint index, bool found) = crowdsale.getCurrentMilestoneIndex();

        // first milestone is reserved for the project to claim initial amount of payments. No refund allowed at this stage.
        if(index == 0) return;

        (uint32 endDate, , , uint32 withdrawalWindow, , ) = crowdsale.getMilestone(index);

        return endDate <= now && now < withdrawalWindow;
    }

    function trancheTransferAllowed() public view returns (bool) {
        (uint index, bool found) = crowdsale.getCurrentMilestoneIndex();
        (uint lastIndex, ) = crowdsale.getLastMilestoneIndex();

        if(!found) return;
        if(index == 0) return true;

        (uint32 endDate, , , , , ) = crowdsale.getMilestone(index);
        (, , ,uint32 lastWithdrawalWindow, , ) = crowdsale.getMilestone(lastIndex);

        return endDate > now || lastWithdrawalWindow <= now;
    }

    modifier onlyFrom(address sender) {
        require(msg.sender == sender);

        _;
    }
}
