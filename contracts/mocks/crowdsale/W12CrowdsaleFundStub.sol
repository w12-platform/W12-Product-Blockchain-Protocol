pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../../rates/IRates.sol";
import "../../crowdsale/W12Fund.sol";
import "../../token/IWToken.sol";


contract W12CrowdsaleFundStub is IW12Fund {

    function setCrowdsale(IW12Crowdsale _crowdsale) external {}

    function setServiceWallet(address _serviceWallet) external {}

    function setSwap(address _swap) external {}

    function transferOwnership(address newOwner) external {}

    struct RecordPurchaseCallResult {
        address investor;
        uint tokenAmount;
        bytes32 symbol;
        uint cost;
        uint costUSD;
        uint _value;
    }

    RecordPurchaseCallResult __recordPurchaseCallResult;
    function _getRecordPurchaseCallResult() external view returns(address, uint, bytes32, uint, uint, uint) {
        return (
            __recordPurchaseCallResult.investor,
            __recordPurchaseCallResult.tokenAmount,
            __recordPurchaseCallResult.symbol,
            __recordPurchaseCallResult.cost,
            __recordPurchaseCallResult.costUSD,
            __recordPurchaseCallResult._value
        );
    }

    function recordPurchase(
        address investor,
        uint tokenAmount,
        bytes32 symbol,
        uint cost,
        uint costUSD
    ) external payable {
        __recordPurchaseCallResult = RecordPurchaseCallResult({
            investor: investor,
            tokenAmount: tokenAmount,
            symbol: symbol,
            cost: cost,
            costUSD: costUSD,
            _value: msg.value
        });
    }

    function _outEther(address to) external {
        return to.transfer(address(this).balance);
    }
}
