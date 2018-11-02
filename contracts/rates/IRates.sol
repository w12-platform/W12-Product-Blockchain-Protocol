pragma solidity ^0.4.24;

import "./ISymbols.sol";
import "../access/roles/IPricer.sol";

contract IRates is ISymbols, IPricerRole {
    function addSymbolWithTokenAddress(bytes32 symbol, address _address) public;

    function setTokenAddress(bytes32 symbol, address _address) public;

    function getTokenAddress(bytes32 symbol) public view returns (address);

    function isToken(bytes32 symbol) public view returns (bool);

    function get(bytes32 symbol) public view returns (uint);

    function set(bytes32 symbol, uint rate) public;
}
