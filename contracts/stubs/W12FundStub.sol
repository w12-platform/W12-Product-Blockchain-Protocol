pragma solidity ^0.4.24;

import "../W12Fund.sol";


contract W12FundStub is W12Fund {
    constructor (address crowdsaleAddress, address swapAddress) public {
        crowdsale = IW12Crowdsale(crowdsaleAddress);
        swap = swapAddress;
    }
}
