pragma solidity ^0.4.24;

import "./IW12CrowdsaleFactory.sol";
import "./IW12FundFactory.sol";
import "../../rates/IRates.sol";
import "../../versioning/Versionable.sol";
import "../W12Crowdsale.sol";

contract W12CrowdsaleFactory is Versionable, IW12CrowdsaleFactory {
    IW12FundFactory private fundFactory;
    IRates private rates;

    event CrowdsaleCreated(address indexed token, address crowdsaleAddress, address fundAddress);

    constructor(uint version, IW12FundFactory _fundFactory, IRates _rates) Versionable(version) public {
        require(_fundFactory != address(0));
        require(_rates != address(0));

        fundFactory = _fundFactory;
        rates = _rates;
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
        address[] owners
    )
        external returns (IW12Crowdsale result)
    {
        IW12Fund fund = fundFactory.createFund(swap, serviceWallet, trancheFeePercent);

        fund.setCrowdsale(result);

        result = new W12Crowdsale(
            version,
            tokenAddress,
            wTokenAddress,
            price,
            serviceWallet,
            swap,
            serviceFee,
            WTokenSaleFeePercent,
            fund,
            rates
        );

        // make crowdsale a admin
        fund.addAdmin(address(result));

        // give the project owner role to addresses from owners list
        for(uint i = 0; i < owners.length; i++) {
            result.addProjectOwner(owners[i]);
        }

        // transfer all permissions to sender
        fund.addAdmin(msg.sender);
        fund.addProjectOwner(msg.sender);
        fund.transferPrimary(msg.sender);
        fund.renounceAdmin();
        fund.renounceProjectOwner();

        // transfer all permissions to sender
        result.addAdmin(msg.sender);
        result.addProjectOwner(msg.sender);
        result.transferPrimary(msg.sender);
        result.renounceAdmin();
        result.renounceProjectOwner();

        emit CrowdsaleCreated(wTokenAddress, address(result), fund);
    }
}
