pragma solidity ^0.4.24;

contract Versionable {
    uint public version;

    constructor(uint _version) public {
        version = _version;
    }
}
