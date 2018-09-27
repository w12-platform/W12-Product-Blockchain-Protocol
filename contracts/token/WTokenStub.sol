pragma solidity ^0.4.24;

import "./WToken.sol";


contract WTokenStub is WToken {

    /**
    * @dev Allows for any account besides the owner.
    */
    modifier onlyOwner() {
        _;
    }

    modifier onlyTrusted(address caller) {
        _;
    }

    constructor(string _name, string _symbol, uint8 _decimals) WToken(_name, _symbol, _decimals) public { }
}
