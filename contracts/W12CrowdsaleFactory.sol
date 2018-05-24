pragma solidity ^0.4.24;

import "./W12Crowdsale.sol";


contract W12CrowdsaleFactory is IW12CrowdsaleFactory {
    function createCrowdsale(address _wTokenAddress, uint32 _startDate, uint price, address serviceWallet, uint8 serviceFee, address owner) external returns (IW12Crowdsale result) {
        result = new W12Crowdsale(WToken(_wTokenAddress), _startDate, price, serviceWallet, serviceFee);
        Ownable(result).transferOwnership(owner);
    }
}
