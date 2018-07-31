pragma solidity ^0.4.23;

import "./W12Lister.sol";

contract W12ListerStub is W12Lister {

    /**
    * @dev Allows for any account besides the owner.
    */
    modifier onlyOwner() {
        _;
    }

    constructor(IW12CrowdsaleFactory _factory, W12TokenLedger _ledger, address _swap) W12Lister(msg.sender, _factory, _ledger, _swap) public { }
}
