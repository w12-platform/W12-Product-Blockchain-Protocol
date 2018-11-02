pragma solidity ^0.4.24;

contract IAdminRole {
    function isAdmin(address account) public view returns (bool);

    function addAdmin(address account) public;

    function removeAdmin(address account) public;

    function renounceAdmin(address account) public;
}
