pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/access/Roles.sol";

contract PricerRole {
    using Roles for Roles.Role;

    event PricerAdded(address indexed account);
    event PricerRemoved(address indexed account);

    Roles.Role private pricers;

    constructor() internal {
        _addPricer(msg.sender);
    }

    modifier onlyPricer() {
        require(isPricer(msg.sender));
        _;
    }

    function isPricer(address account) public view returns (bool) {
        return pricers.has(account);
    }

    function renouncePricer() public {
        _removePricer(msg.sender);
    }

    function _addPricer(address account) internal {
        require(account != address(0));

        pricers.add(account);
        emit PricerAdded(account);
    }

    function _removePricer(address account) internal {
        require(account != address(0));

        pricers.remove(account);
        emit PricerRemoved(account);
    }
}
