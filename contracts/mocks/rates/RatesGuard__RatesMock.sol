pragma solidity ^0.4.24;

import "../../rates/IRates.sol";

contract RatesGuard__RatesMock is IRates {
    function addSymbolWithTokenAddress(bytes32 symbol, address _address) public {}

    function setTokenAddress(bytes32 symbol, address _address) public {}

    function getTokenAddress(bytes32 symbol) public view returns (address) {}

    function isToken(bytes32 symbol) public view returns (bool) {}

    mapping(bytes32 => uint) __rates;

    function _get(bytes32 symbol, uint rate) public {
        __rates[symbol] = rate;
    }

    function get(bytes32 symbol) public view returns (uint) {
        return __rates[symbol];
    }

    struct SetCall {
        bytes32 symbol;
        uint rate;
    }

    SetCall[] __setCall;

    bool __setRevertEnabled;

    function _setCallResult() public view returns(bytes32[], uint[]) {
        bytes32[] memory symbols = new bytes32[](__setCall.length);
        uint[] memory rates = new uint[](__setCall.length);

        for(uint i = 0; i < __setCall.length; i++) {
            symbols[i] = __setCall[i].symbol;
            rates[i] = __setCall[i].rate;
        }

        return (symbols, rates);
    }

    function _setRevertEnabled(bool flag) public {
        __setRevertEnabled = flag;
    }

    function set(bytes32 symbol, uint rate) public {
        if (__setRevertEnabled) revert();
        __setCall.push(SetCall(symbol, rate));
    }

    function addSymbol(bytes32 symbol) public {}

    function removeSymbol(bytes32 symbol) public {}

    mapping(bytes32 => bool) __hasSymbol;

    function _hasSymbol(bytes32 symbol, bool flag) public {
        __hasSymbol[symbol] = flag;
    }

    function hasSymbol(bytes32 symbol) public view returns (bool) {
        return __hasSymbol[symbol];
    }

    function getSymbolsList() public view returns (bytes32[]) {}

    function isPricer(address account) public view returns (bool) {}

    function addPricer(address account) public {}

    function removePricer(address account) public {}

    function renouncePricer() public {}
}
