pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Percent.sol";

contract PercentMock {
    using SafeMath for uint;
    using Percent for uint;

    function percent(uint _a, uint _b) public pure returns (uint)  {
        return Percent.percent(_a, _b);
    }

    function isPercent(uint _a) public pure returns (bool) {
        return Percent.isPercent(_a);
    }

    function toPercent(uint _a) public pure returns (uint) {
        return Percent.toPercent(_a);
    }

    function fromPercent(uint _a) public pure returns (uint) {
        return Percent.fromPercent(_a);
    }
}
