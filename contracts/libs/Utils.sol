pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library Utils {
    using SafeMath for uint;

    /**
     * @dev Do convert `value` with `decimals` as position of point to another by `rate`.
     *      This a workaround avoids overflow in some case.
     */
    function saveConvertByRate(uint value, uint decimals, uint rate) public pure returns (uint) {
        return value.div(10 ** decimals).mul(rate).add((value % (10 ** decimals)).mul(rate).div(10 ** decimals));
    }

    /**
     * @dev Do reconvert `value` that has converted by `rate`.
     *      This a workaround avoids overflow in some case.
     */
    function saveReconvertByRate(uint value, uint decimals, uint rate) public pure returns (uint) {
        return value.div(rate).mul(10 ** decimals).add((value % rate).mul(10 ** decimals).div(rate));
    }
}
