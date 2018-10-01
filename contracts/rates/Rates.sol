pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./roles/Pricer.sol";
import "./Symbols.sol";

contract Rates is Symbols, PricerRole, Ownable {
    mapping (bytes32 => uint) rates;

    function addSymbol(bytes32 symbol) public onlyPricer {
        Symbols.addSymbol(symbol);
    }

    function removeSymbol(bytes32 symbol) public onlyPricer {
        Symbols.removeSymbol(symbol);
        rates[symbol] = 0;
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
