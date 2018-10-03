pragma solidity ^0.4.24;

contract IPricerRole {
    function isPricer(address account) public view returns (bool);

    function addPricer(address account) public;

    function removePricer(address account) public;
}
