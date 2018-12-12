pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/access/Roles.sol";

contract SuggestorRole {
    using Roles for Roles.Role;

    event SuggestorAdded(address indexed account);
    event SuggestorRemoved(address indexed account);

    Roles.Role private suggestors;

    constructor() internal {
        _addSuggestor(msg.sender);
    }

    modifier onlySuggestor() {
        require(isSuggestor(msg.sender));
        _;
    }

    function isSuggestor(address account) public view returns (bool) {
        return suggestors.has(account);
    }

    function renounceSuggestor() public {
        _removeSuggestor(msg.sender);
    }

    function _addSuggestor(address account) internal {
        suggestors.add(account);
        emit SuggestorAdded(account);
    }

    function _removeSuggestor(address account) internal {
        suggestors.remove(account);
        emit SuggestorRemoved(account);
    }
}
