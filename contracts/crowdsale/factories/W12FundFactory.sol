pragma solidity ^0.4.24;

import "./IW12FundFactory.sol";
import "../W12Fund.sol";
import "../../versioning/Versionable.sol";

contract W12FundFactory is Versionable, IW12FundFactory {
    IRates rates;

    event FundCreated(address indexed fund);

    constructor(uint version, IRates _rates) Versionable(version) public {
        rates = _rates;
    }

    function createFund(address swap, address serviceWallet, uint trancheFeePercent) external returns (IW12Fund result) {
        result = new W12Fund(version, trancheFeePercent, rates);

        result.setSwap(swap);
        result.setServiceWallet(serviceWallet);
        result.transferOwnership(msg.sender);

        emit FundCreated(result);
    }
}
