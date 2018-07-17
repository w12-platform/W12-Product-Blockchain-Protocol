pragma solidity ^0.4.23;

import "./W12Lister.sol";

contract W12ListerStub is W12Lister {

    /**
    * @dev Allows for any account besides the owner.
    */
    modifier onlyOwner() {
        _;
    }

    constructor(address _serviceWallet, IW12CrowdsaleFactory _factory) W12Lister(_serviceWallet, _factory) public { }
}
