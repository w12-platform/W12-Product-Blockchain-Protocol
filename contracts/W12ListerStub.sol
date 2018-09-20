pragma solidity ^0.4.23;

import "./W12Lister.sol";

contract W12ListerStub is W12Lister {

    /**
    * @dev Allows for any account besides the owner.
    */
    modifier onlyOwner() {
        _;
    }

    constructor(
        uint version,
        IW12CrowdsaleFactory _factory,
        W12TokenLedger _ledger,
        IW12AtomicSwap _swap
    ) W12Lister(version, msg.sender, _factory, _ledger, _swap) public { }
}
