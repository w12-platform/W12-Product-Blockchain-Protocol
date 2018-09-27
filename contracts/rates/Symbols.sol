pragma solidity ^0.4.24;

contract Symbols {
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

    function _removeSymbolByIndex(uint index) internal {
        require(index < symbolsList.length);

        for (uint i = index; i < symbolsList.length - 1; i++) {
            symbolsList[i] = symbolsList[i + 1];
        }

        delete symbolsList[symbolsList.length - 1];
        symbolsList.length--;
    }
}
