pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library FundAccount {
    using SafeMath for uint;

    struct Account {
        bytes32[] _symbolsList;
        mapping ( bytes32 => bool ) symbols;
        mapping ( bytes32 => uint ) amount;
    }

    function deposit(Account storage _account, bytes32 _symbol, uint _amount) public {
        _writeSymbol(_account, _symbol);

        _account.amount[_symbol] = _account.amount[_symbol].add(_amount);
    }

    function withdrawal(Account storage _account, bytes32 _symbol, uint _amount) public {
        require(hasDepositIn(_account, _symbol));
        require(amountOf(_account, _symbol) >= _amount);

        _account.amount[_symbol] = _account.amount[_symbol].sub(_amount);
    }

    function hasDepositIn(Account storage _account, bytes32 _symbol) public view returns(bool) {
        return _account.symbols[_symbol];
    }

    function amountOf(Account storage _account, bytes32 _symbol) public view returns(uint) {
        return _account.amount[_symbol];
    }

    function symbolsList(Account storage _account) public view returns(bytes32[]) {
        return _account._symbolsList;
    }

    function _writeSymbol(Account storage _account, bytes32 _symbol) public {
        if (!hasDepositIn(_account, _symbol)) {
            _account._symbolsList.push(_symbol);
            _account.symbols[_symbol] = true;
        }
    }
}
