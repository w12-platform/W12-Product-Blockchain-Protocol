pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/access/Roles.sol";


contract ProjectOwnerRole {
    using Roles for Roles.Role;

    event ProjectOwnerAdded(address indexed account);
    event ProjectOwnerRemoved(address indexed account);

    Roles.Role private projectOwners;

    constructor() internal {
        _addProjectOwner(msg.sender);
    }

    modifier onlyProjectOwner() {
        require(isProjectOwner(msg.sender));
        _;
    }

    function isProjectOwner(address account) public view returns (bool) {
        return projectOwners.has(account);
    }

    function renounceProjectOwner() public {
        _removeProjectOwner(msg.sender);
    }

    function _addProjectOwner(address account) internal {
        projectOwners.add(account);
        emit ProjectOwnerAdded(account);
    }

    function _removeProjectOwner(address account) internal {
        projectOwners.remove(account);
        emit ProjectOwnerRemoved(account);
    }
}
