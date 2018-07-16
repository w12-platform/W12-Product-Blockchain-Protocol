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
    uint totalFunded;

    struct TokenPriceInfo {
        uint totalBought;
        uint averagePrice;
        uint totalFunded;
    }

    event FundsReceived(address indexed buyer, uint etherAmount, uint tokenAmount);

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

    function refund(uint wtokensToRefund) external nonReentrant {
        require(wToken.balanceOf(msg.sender) >= wtokensToRefund);
        require(buyers[msg.sender].totalBought >= wtokensToRefund);

        require(wToken.transferFrom(msg.sender, swap, wtokensToRefund));

        uint share = totalFunded.div(buyers[msg.sender].totalFunded);
        uint refundTokensShare = buyers[msg.sender].totalBought.div(wtokensToRefund);

        msg.sender.transfer(share.div(refundTokensShare));
    }

    modifier onlyFrom(address sender) {
        require(msg.sender == sender);

        _;
    }
}
