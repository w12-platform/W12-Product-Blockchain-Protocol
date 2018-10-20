// TODO: write tests

require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');
const UtilsMock = artifacts.require('UtilsMock');

contract('UtilsMock', (accounts) => {
    const ctx = {};
    const bigTokenValue = new BigNumber(new Array(7).fill('1234567890').join(''));
    const bigTokenDecimals = 68;
    const rate = 1000000000;
    const oneBigToken = BigNumber.TEN.pow(bigTokenDecimals);

    before(async () => {
        ctx.lib = await UtilsMock.new();
    });

    describe('safeConversionByRate', () => {
        const expected = utils.round(new BigNumber(bigTokenValue).mul(rate).div(oneBigToken));

        it('should return result', async () => {
            const actual = await ctx.lib.safeConversionByRate(bigTokenValue, bigTokenDecimals, rate);

            actual.should.bignumber.eq(expected);
        });
    });

    describe('safeReverseConversionByRate', () => {
        const value = utils.round(new BigNumber(bigTokenValue).mul(rate).div(oneBigToken));
        const expected = utils.round(new BigNumber(value).mul(oneBigToken).div(rate));

        it('should return result', async () => {
            const actual = await ctx.lib.safeReverseConversionByRate(value, bigTokenDecimals, rate);

            actual.should.bignumber.eq(expected);
        });
    });

    describe('safeMulDiv', () => {
        it('should return result', async () => {
            const actual = await ctx.lib.safeMulDiv(BigNumber.UINT_MAX, 10, 10);

            actual.should.bignumber.eq(BigNumber.UINT_MAX);
        });
    });
});
