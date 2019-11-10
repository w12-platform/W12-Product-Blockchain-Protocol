pragma solidity 0.4.24;

import "./IW12FundFactory.sol";
import "../W12Fund.sol";
import "../../versioning/Versionable.sol";


contract W12FundFactory is Versionable, IW12FundFactory {
    IRates rates;
    address oracles;

    event FundCreated(address indexed fund);

    constructor(uint version, IRates _rates, address oracles_addr) Versionable(version) public {
        rates = _rates;
        oracles = oracles_addr;
    }

    function createFund(address swap, address serviceWallet, uint trancheFeePercent) external returns (IW12Fund result) {
        result = new W12Fund(version, trancheFeePercent, rates, oracles);

        result.setSwap(swap);
        result.setServiceWallet(serviceWallet);

        // transfer all permissions to sender
        result.addAdmin(msg.sender);
        result.addProjectOwner(msg.sender);
        result.transferPrimary(msg.sender);
        result.renounceAdmin();
        result.renounceProjectOwner();

        emit FundCreated(result);
    }
}
