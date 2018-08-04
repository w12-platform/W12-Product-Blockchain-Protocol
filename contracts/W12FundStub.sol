pragma solidity ^0.4.24;

import "./W12Fund.sol";
import "./WToken.sol";


contract W12FundStub is W12Fund {
    constructor (address crowdsaleAddress, address swapAddress, address wTokenAddress) public {
        crowdsale = IW12Crowdsale(crowdsaleAddress);
        swap = swapAddress;
        wToken = WToken(wTokenAddress);
        tokenDecimals = wToken.decimals();
    }

    function _setTotalFunded(uint amount) external {
        totalFunded = amount;
    }

    function _setTotalRefunded(uint amount) external {
        totalRefunded = amount;
    }

    // allow any sender
    modifier onlyFrom(address sender) {
        _;
    }
}
