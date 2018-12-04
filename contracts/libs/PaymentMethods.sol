pragma solidity ^0.4.24;

library PaymentMethods {
    struct Method {
        bytes32 symbol;
        bool hasPurchaseFee;
        uint purchaseFee;
    }

    struct Methods {
        Method[] _list;
        mapping(bytes32 => uint) _indexes;
        mapping (bytes32 => bool) _allowed;
    }

    function clear(Methods storage _methods) public {
        uint i;

        if (_methods._list.length != 0) {
            for (i = 0; i < _methods._list.length; i++) {
                _methods._allowed[_methods._list[i].symbol] = false;
            }
        }

        _methods._list.length = 0;
    }

    function addRaw(Methods storage _methods, bytes32 _symbol, bool _hasPurchaseFee, uint _purchaseFee) public {
        _methods._allowed[_symbol] = true;
        _methods._indexes[_symbol] = _methods._list.length;
        _methods._list.push(Method(_symbol, _hasPurchaseFee, _purchaseFee));
    }

    function add(Methods storage _methods, Method _method) internal {
        _methods._allowed[_method.symbol] = true;
        _methods._indexes[_method.symbol] = _methods._list.length;
        _methods._list.push(_method);
    }

    function bySymbol(Methods storage _methods, bytes32 _symbol) internal view returns(Method)  {
        require(isAllowed(_methods, _symbol));
        return _methods._list[_methods._indexes[_symbol]];
    }

    function isAllowed(Methods storage _methods, bytes32 _method) public view returns(bool) {
        return _methods._allowed[_method];
    }

     function list(Methods storage _methods) internal view returns(Method[]) {
         return _methods._list;
     }

    function symbols(Methods storage _methods) public view returns (bytes32[]) {
        bytes32[] memory list = new bytes32[](_methods._list.length);
        for(uint i = 0; i < _methods._list.length; i++) {
            list[i] = _methods._list[i].symbol;
        }
        return list;
    }
}
