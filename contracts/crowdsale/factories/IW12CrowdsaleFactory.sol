pragma solidity ^0.4.24;

import "../IW12Crowdsale.sol";


interface IW12CrowdsaleFactory {
    function createCrowdsale(
        address tokenAddress,
        address _wTokenAddress,
        uint price,
        address serviceWallet,
        uint serviceFee,
        uint WTokenSaleFeePercent,
        uint trancheFeePercent ,
        address swap,
        address owner
    )
        external returns (IW12Crowdsale);
}
