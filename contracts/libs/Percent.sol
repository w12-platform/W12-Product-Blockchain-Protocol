pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Utils.sol";

library Percent {
    using SafeMath for uint;

    function ADD_EXP() public pure returns (uint) { return 2; }
    function EXP() public pure returns (uint) { return 2 + ADD_EXP(); }
    function MIN() public pure returns (uint) { return 0; }
    function MAX() public pure returns (uint) { return 10 ** EXP(); }

    function percent(uint _a, uint _b) internal pure returns (uint) {
        return _a.mul(_b).div(MAX());
    }

    function safePercent(uint _a, uint _b) internal pure returns (uint) {
        return Utils.safeMulDiv(_a, _b, MAX());
    }

    function isPercent(uint _a) internal pure returns (bool) {
        return _a >= MIN() && _a <= MAX();
    }

    function toPercent(uint _a) internal pure returns (uint) {
        require(_a <= 100);

        return _a.mul(10 ** ADD_EXP());
    }

    function fromPercent(uint _a) internal pure returns (uint) {
        require(isPercent(_a));

        return _a.div(10 ** ADD_EXP());
    }
}
