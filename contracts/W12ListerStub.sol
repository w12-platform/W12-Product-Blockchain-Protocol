pragma solidity ^0.4.24;

import "./W12Lister.sol";
import "./token/exchanger/ITokenExchanger.sol";

contract W12ListerStub is W12Lister {

    /**
    * @dev Allows for any account besides the owner.
    */
    modifier onlyOwner() {
        _;
    }

    modifier onlyRole(string _role) {
        _;
    }

    constructor(
        uint version,
        IW12CrowdsaleFactory _factory,
        ITokenExchanger _exchanger
    ) W12Lister(version, msg.sender, _factory, _exchanger) public { }
}
