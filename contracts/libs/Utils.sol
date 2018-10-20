pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library Utils {
    using SafeMath for uint;

    uint constant MAX_UINT = uint(-1);

    /**
     * @dev Do convert `value` with `decimals` as position of point to another by `rate`.
     *      This a workaround avoids overflow in some case.
     */
    function safeConversionByRate(uint value, uint decimals, uint rate) public pure returns (uint) {
        return value.div(10 ** decimals).mul(rate).add((value % (10 ** decimals)).mul(rate).div(10 ** decimals));
    }

    /**
     * @dev Do reverse conversion of `value` by `rate`(see `safeConversionByRate`).
     *      This a workaround avoids overflow in some case.
     */
    function safeReverseConversionByRate(uint value, uint decimals, uint rate) public pure returns (uint) {
        return value.div(rate).mul(10 ** decimals).add((value % rate).mul(10 ** decimals).div(rate));
    }

    /**
     * @dev Doing multiplying `a` by `b` and then divide by `c`. In some case it avoids overflow.
     *      (2^256-1) * 2 / 2 = (2^256-1) - no overflow when (2^256-1) * 2
     */
    function safeMulDiv(uint a, uint b, uint c) internal pure returns(uint result) {
        uint fractionsSum;

        assert(c != 0);
        
        if(a == 0 || b == 0) return;

        uint maxA = MAX_UINT.div(b);

        if (a <= maxA) return a.mul(b).div(c);
        if (a == c) return b;
        if (b == c) return a;

        while (a != 0) {
            uint aPart = maxA > a ? a : maxA;
            uint aPartByBProd = aPart.mul(b);

            result = result.add(aPartByBProd.div(c));
            fractionsSum = fractionsSum.add(aPartByBProd % c);

            a = a.sub(aPart);
        }

        result = result.add(fractionsSum.div(c));
    }
}
