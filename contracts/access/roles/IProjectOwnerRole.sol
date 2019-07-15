pragma solidity 0.4.24;


contract IProjectOwnerRole {
    function isProjectOwner(address account) public view returns (bool);

    function addProjectOwner(address account) public;

    function renounceProjectOwner() public;

    function removeProjectOwner(address account) public;
}
