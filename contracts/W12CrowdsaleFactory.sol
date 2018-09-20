pragma solidity ^0.4.24;

import "./interfaces/IW12CrowdsaleFactory.sol";
import "./interfaces/IW12FundFactory.sol";
import "./W12Crowdsale.sol";
import "./versioning/Versionable.sol";


contract W12CrowdsaleFactory is Versionable, IW12CrowdsaleFactory {
    IW12FundFactory private fundFactory;

    event CrowdsaleCreated(address indexed owner, address indexed token, address crowdsaleAddress, address fundAddress);

    constructor(uint version, IW12FundFactory _fundFactory) Versionable(version) public {
        require(_fundFactory != address(0), "Factory address required");

        fundFactory = _fundFactory;
    }

    function createCrowdsale(
        address tokenAddress,
        address wTokenAddress,
        uint price,
        address serviceWallet,
        uint serviceFee,
        uint WTokenSaleFeePercent,
        uint trancheFeePercent,
        address swap,
        address owner
    )
        external returns (IW12Crowdsale result)
    {
        IW12Fund fund = fundFactory.createFund(swap, serviceWallet, trancheFeePercent);

        result = new W12Crowdsale(
            version,
            tokenAddress,
            wTokenAddress,
            price,
            serviceWallet,
            swap,
            serviceFee,
            WTokenSaleFeePercent,
            fund
        );

        result.transferOwnership(owner);

        fund.setCrowdsale(result);
        fund.transferOwnership(owner);

        emit CrowdsaleCreated(owner, wTokenAddress, address(result), fund);
    }
}
