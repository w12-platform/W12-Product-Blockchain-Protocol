pragma solidity ^0.4.24;

import "./W12Crowdsale.sol";
import "./W12Fund.sol";


contract W12CrowdsaleFactory is IW12CrowdsaleFactory {

    event CrowdsaleCreated(address indexed owner, address indexed token, uint32 startDate, address crowdsaleAddress, address fundAddress);

    function createCrowdsale(
        address wTokenAddress,
        uint32 startDate,
        uint price,
        address serviceWallet,
        uint8 serviceFee,
        address swap,
        address owner)
        external returns (IW12Crowdsale result) {

        W12Fund fund = new W12Fund();

        result = new W12Crowdsale(WToken(wTokenAddress), startDate, price, serviceWallet, serviceFee, fund);
        Ownable(result).transferOwnership(owner);

        fund.setCrowdsale(result);
        fund.setSwap(swap);
        Ownable(fund).transferOwnership(owner);

        emit CrowdsaleCreated(owner, wTokenAddress, startDate, result, fund);
    }
}
