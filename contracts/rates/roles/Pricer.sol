pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/access/rbac/Roles.sol";
import "./IPricer.sol";

contract PricerRole is IPricerRole {
    using Roles for Roles.Role;

    event PricerAdded(address indexed account);
    event PricerRemoved(address indexed account);

    Roles.Role private pricers;

    constructor() public {
        _addPricer(msg.sender);
    }

    modifier onlyPricer() {
        require(isPricer(msg.sender));
        _;
    }

    function isPricer(address account) public view returns (bool) {
        return pricers.has(account);
    }

    function addPricer(address account) public onlyPricer {
        _addPricer(account);
    }

    function removePricer(address account) public {
        _removePricer(account);
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
