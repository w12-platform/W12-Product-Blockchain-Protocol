pragma solidity ^0.4.24;

import "./ISymbols.sol";

contract Symbols is ISymbols {
    bytes32[] public symbolsList;
    mapping (bytes32 => uint) symbolIndex;
    mapping (bytes32 => bool) symbols;

    function addSymbol(bytes32 symbol) public {
        require(!symbols[symbol]);

        symbols[symbol] = true;
        symbolIndex[symbol] = symbolsList.length;
        symbolsList.push(symbol);
    }

    function removeSymbol(bytes32 symbol) public {
        require(symbols[symbol]);

        symbols[symbol] = false;

        uint index = symbolIndex[symbol];

        symbolIndex[symbol] = 0;

        if (index != symbolsList.length - 1) {
            symbolsList[index] = symbolsList[symbolsList.length - 1];
            symbolIndex[symbolsList[index]] = index;
        }

        symbolsList.length--;
    }

    function hasSymbol(bytes32 symbol) public view returns(bool) {
        return symbols[symbol];
    }

    function getSymbolsList() public view returns(bytes32[]) {
        return symbolsList;
    }
}
