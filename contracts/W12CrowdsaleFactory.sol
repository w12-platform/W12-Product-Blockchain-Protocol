pragma solidity ^0.4.24;

import "./W12Crowdsale.sol";


contract W12CrowdsaleFactory is IW12CrowdsaleFactory {

    event CrowdsaleCreated(address indexed owner, address indexed token, uint32 startDate, address crowdsaleAddress);

    function createCrowdsale(
        address wTokenAddress,
        uint32 startDate,
        uint price,
        address serviceWallet,
        uint8 serviceFee,
        address fund,
        address owner)
        external returns (IW12Crowdsale result) {

        result = new W12Crowdsale(WToken(wTokenAddress), startDate, price, serviceWallet, serviceFee, fund);
        Ownable(result).transferOwnership(owner);
        emit CrowdsaleCreated(owner, wTokenAddress, startDate, result);
    }
}
