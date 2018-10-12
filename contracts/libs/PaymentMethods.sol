pragma solidity ^0.4.24;

library PaymentMethods {
    struct Methods {
        bytes32[] _list;
        mapping (bytes32 => bool) _allowed;
    }

    function update(Methods storage _methods, bytes32[] _list) internal {
        uint i;

        if (_methods._list.length != 0) {
            for (i = 0; i < _methods._list.length; i++) {
                _methods._allowed[_methods._list[i]] = false;
            }
        }

        _methods._list = _list;

        if (_list.length != 0) {
            for (i = 0; i < _list.length; i++) {
                _methods._allowed[_list[i]] = true;
            }
        }
    }

    function isAllowed(Methods storage _methods, bytes32 _method) internal view returns(bool) {
        return _methods._allowed[_method];
    }

    function list(Methods storage _methods) internal view returns(bytes32[]) {
        return _methods._list;
    }
}
