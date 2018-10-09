pragma solidity ^0.4.24;

import "../../rates/IRates.sol";
import "../../crowdsale/W12Fund.sol";
import "../../token/IWToken.sol";


contract W12FundStub is W12Fund {
    constructor (
        uint version,
        address crowdsaleAddress,
        address swapAddress,
        address wTokenAddress,
        address _serviceWallet,
        uint _trancheFeePercent,
        IRates _rates
    )
        W12Fund(version, _trancheFeePercent, _rates) public
    {
        crowdsale = IW12Crowdsale(crowdsaleAddress);
        swap = swapAddress;
        wToken = IWToken(wTokenAddress);
        trancheFeePercent = _trancheFeePercent;
        serviceWallet = _serviceWallet;
    }

//    function _setTotalFunded(uint amount) external {
//        totalFunded = amount;
//    }
//
//    function _setTotalRefunded(uint amount) external {
//        totalRefunded = amount;
//    }

    function() payable external {}

    // allow any sender
    modifier onlyFrom(address sender) {
        _;
    }
}
