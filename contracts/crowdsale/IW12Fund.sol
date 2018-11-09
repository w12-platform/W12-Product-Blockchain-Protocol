pragma solidity ^0.4.24;

import "./IW12Crowdsale.sol";
import "../access/roles/IAdminRole.sol";
import "../access/roles/IProjectOwnerRole.sol";

interface IW12Fund is IAdminRole, IProjectOwnerRole {
    function setCrowdsale(IW12Crowdsale _crowdsale) external;

    function setServiceWallet(address _serviceWallet) external;

    function setSwap(address _swap) external;

    function transferPrimary(address _address) external;

    function recordPurchase(
        address investor,
        uint tokenAmount,
        bytes32 symbol,
        uint cost,
        uint costUSD
    ) external payable;
}
