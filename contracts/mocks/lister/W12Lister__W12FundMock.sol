pragma solidity ^0.4.24;

import "../../crowdsale/IW12Crowdsale.sol";
import "../../crowdsale/IW12Fund.sol";

contract W12Lister__W12FundMock is IW12Fund {
    function setCrowdsale(IW12Crowdsale _crowdsale) external {}

    function setServiceWallet(address _serviceWallet) external {}

    function setSwap(address _swap) external {}

    function transferPrimary(address _address) public {}

    function isAdmin(address account) public view returns (bool) {}

    address public _addAdminCall;

    function addAdmin(address account) public {
        _addAdminCall = account;
    }

    function renounceAdmin() public {}

    function removeAdmin(address account) public {}

    function isProjectOwner(address account) public view returns (bool) {}

    function addProjectOwner(address account) public {}

    function renounceProjectOwner() public {}

    function removeProjectOwner(address account) public {}

    function recordPurchase(
        address investor,
        uint tokenAmount,
        bytes32 symbol,
        uint cost,
        uint costUSD
    ) external payable {}
}
