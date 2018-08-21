pragma solidity ^0.4.24;

import "../../openzeppelin-solidity/contracts/math/SafeMath.sol";

library Percent {
    using SafeMath for uint;

    function percent(uint _a, uint _b) internal pure returns (uint) {
        require(isPercent(_b));

        return _a.mul(_b).div(10000);
    }

    function isPercent(uint _a) internal pure returns (bool) {
        return _a >= 100 && _a <= 10000;
    }

    function toPercent(uint _a) internal pure returns (uint) {
        require(_a <= 100);

        return _a.mul(100);
    }

    function fromPercent(uint _a) internal pure returns (uint) {
        require(isPercent(_a));

        return _a.div(100);
    }
}
