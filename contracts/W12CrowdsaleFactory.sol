pragma solidity ^0.4.24;

import "./interfaces/IW12CrowdsaleFactory.sol";
import "./interfaces/IW12FundFactory.sol";
import "./W12Crowdsale.sol";


contract W12CrowdsaleFactory is IW12CrowdsaleFactory {
    IW12FundFactory private fundFactory;

    event CrowdsaleCreated(address indexed owner, address indexed token, uint32 startDate, address crowdsaleAddress, address fundAddress);

    constructor(IW12FundFactory _fundFactory) public {
        require(_fundFactory != address(0), "Factory address required");

        fundFactory = _fundFactory;
    }

    function createCrowdsale(address wTokenAddress, uint32 startDate, uint price, address serviceWallet, uint serviceFee, address swap, address owner)
        external returns (IW12Crowdsale result) {
        IW12Fund fund = fundFactory.createFund(swap);

        result = new W12Crowdsale(wTokenAddress, DetailedERC20(wTokenAddress).decimals(), startDate, price, serviceWallet, serviceFee, fund);
        result.transferOwnership(owner);

        fund.setCrowdsale(result);
        fund.transferOwnership(owner);

        emit CrowdsaleCreated(owner, wTokenAddress, startDate, address(0), fund);
    }
}
