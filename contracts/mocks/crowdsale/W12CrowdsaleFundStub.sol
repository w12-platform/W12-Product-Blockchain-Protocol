pragma solidity 0.4.24;

import "../../rates/IRates.sol";
import "../../crowdsale/W12Fund.sol";
import "../../token/IWToken.sol";


contract W12CrowdsaleFundStub is IW12Fund {

    function setCrowdsale(IW12Crowdsale _crowdsale) external {}

    function setServiceWallet(address _serviceWallet) external {}

    function setSwap(address _swap) external {}

    function transferPrimary(address _address) public {}

    function isAdmin(address account) public view returns (bool) {}

    function addAdmin(address account) public {}

    function renounceAdmin() public {}

    function removeAdmin(address account) public {}

    function isProjectOwner(address account) public view returns (bool) {}

    function addProjectOwner(address account) public {}

    function renounceProjectOwner() public {}

    function removeProjectOwner(address account) public {}

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
