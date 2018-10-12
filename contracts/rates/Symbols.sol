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
        _removeSymbolByIndex(symbolIndex[symbol]);
        symbolIndex[symbol] = 0;
    }

    function hasSymbol(bytes32 symbol) public view returns(bool) {
        return symbols[symbol];
    }

    function getSymbolsList() public view returns(bytes32[]) {
        return symbolsList;
    }

    function _removeSymbolByIndex(uint index) internal {
        require(index < symbolsList.length);

        if (index != symbolsList.length - 1) {
            symbolsList[index] = symbolsList[symbolsList.length - 1];
        }

        symbolsList.length--;
    }
}
