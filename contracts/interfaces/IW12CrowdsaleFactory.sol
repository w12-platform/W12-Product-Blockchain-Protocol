pragma solidity ^0.4.24;

import "./IW12Crowdsale.sol";


interface IW12CrowdsaleFactory {
    function createCrowdsale(address _wTokenAddress, uint32 _startDate, uint price, address serviceWallet, uint serviceFee, address swap, address owner) external returns (IW12Crowdsale);
}
