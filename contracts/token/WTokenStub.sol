pragma solidity 0.4.24;

import "./WToken.sol";


contract WTokenStub is WToken {

    /**
    * @dev Allows for any account besides the owner.
    */
    modifier onlyPrimary() {
        _;
    }

    modifier onlyAdmin {
        _;
    }

    // solhint-disable-next-line no-empty-blocks
    constructor(string _name, string _symbol, uint8 _decimals) public WToken(_name, _symbol, _decimals) {}
}
