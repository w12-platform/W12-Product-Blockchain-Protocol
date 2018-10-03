pragma solidity ^0.4.24;


contract IRates {
    address public owner;

    function addSymbol(bytes32 symbol, address _address) public;

    function removeSymbol(bytes32 symbol) public;

    function hasSymbol(bytes32 symbol) public view returns (bool);

    function getSymbolsList() public view returns (bytes32[]);

    function setTokenAddress(bytes32 symbol, address _address) public;

    function getTokenAddress(bytes32 symbol) public view returns (address);

    function isToken(bytes32 symbol) public view returns (bool);

    function addPricer(address account) public;

    function removePricer(address account) public;

    function isPricer(address account) public view returns (bool);

    function get(bytes32 symbol) public view returns (uint);

    function set(bytes32 symbol, uint rate) public;

    function renounceOwnership() public;

    function transferOwnership(address _newOwner) public;
}
