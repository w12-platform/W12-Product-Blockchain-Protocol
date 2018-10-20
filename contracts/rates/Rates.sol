pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./IRates.sol";
import "./roles/Pricer.sol";
import "./Symbols.sol";

contract Rates is IRates, Symbols, PricerRole, Ownable {
    mapping (bytes32 => uint) rates;
    mapping (bytes32 => address) tokenAddress;

    function addSymbolWithTokenAddress(bytes32 symbol, address _address) public onlyPricer {
        Symbols.addSymbol(symbol);

        if (_address != address(0)) setTokenAddress(symbol, _address);
    }

    function addSymbol(bytes32 symbol) public onlyPricer {
        Symbols.addSymbol(symbol);
    }

    function removeSymbol(bytes32 symbol) public onlyPricer {
        setTokenAddress(symbol, address(0));
        Symbols.removeSymbol(symbol);
        rates[symbol] = 0;
    }

    function setTokenAddress(bytes32 symbol, address _address) public onlyPricer {
        require(hasSymbol(symbol));

        tokenAddress[symbol] = _address;
    }

    function getTokenAddress(bytes32 symbol) public view returns(address) {
        require(isToken(symbol));

        return tokenAddress[symbol];
    }

    function isToken(bytes32 symbol) public view returns (bool) {
        require(hasSymbol(symbol));

        return tokenAddress[symbol] != address(0);
    }

    function addPricer(address account) public onlyOwner {
        PricerRole.addPricer(account);
    }

    function removePricer(address account) public onlyOwner {
        PricerRole.removePricer(account);
    }

    function get(bytes32 symbol) public view returns(uint) {
        require(hasSymbol(symbol));

        return rates[symbol];
    }

    function set(bytes32 symbol, uint rate) public onlyPricer {
        require(hasSymbol(symbol));

        rates[symbol] = rate;
    }
}
