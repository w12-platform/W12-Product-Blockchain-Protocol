pragma solidity ^0.4.24;

import "../../libs/Utils.sol";

contract UtilsMock {

    function safeConversionByRate(uint value, uint decimals, uint rate) public pure returns (uint) {
        return Utils.safeConversionByRate(value, decimals, rate);
    }

    function safeReverseConversionByRate(uint value, uint decimals, uint rate) public pure returns (uint) {
        return Utils.safeReverseConversionByRate(value, decimals, rate);
    }

    function safeMulDiv(uint a, uint b, uint c) public pure returns(uint) {
        return Utils.safeMulDiv(a, b, c);
    }
}
