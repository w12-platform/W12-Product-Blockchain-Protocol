require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const Rates = artifacts.require('Rates');

contract('Rates', async (accounts) => {
    const owner = accounts[0];
    const notOwner = accounts[1];
    const pricer1 = accounts[2];
    const pricer2 = accounts[3];
    const ctx = {};

    beforeEach(async () => {
        ctx.Rates = await Rates.new();
    });

    describe('add pricer', async () => {
        beforeEach(async () => {
            ctx.Tx = ctx.Rates.addPricer(pricer1);
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should be a pricer', async () => {
            await ctx.Tx;
            const actual = await ctx.Rates.isPricer(pricer1);

            actual.should.to.be.true;
        });

        it('should`t be a pricer', async () => {
            await ctx.Tx;
            const actual = await ctx.Rates.isPricer(pricer2);

            actual.should.to.be.false;
        });

        it('should revert if not owner', async () => {
            await ctx.Rates.addPricer(pricer2, { from: notOwner })
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe('remove pricer', async () => {
        beforeEach(async () => {
            await ctx.Rates.addPricer(pricer1);
            ctx.Tx = ctx.Rates.removePricer(pricer1);
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should`t be a pricer', async () => {
            await ctx.Tx;
            const actual = await ctx.Rates.isPricer(pricer1);

            actual.should.to.be.false;
        });

        it('should revert if not owner', async () => {
            await ctx.Tx;
            await ctx.Rates.addPricer(pricer1);
            await ctx.Rates.removePricer(pricer1, {from: notOwner})
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe('add symbol', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';

        beforeEach(async () => {
            await ctx.Rates.addPricer(pricer1);
            ctx.Tx = ctx.Rates.addSymbol(web3.fromUtf8(symbol1), { from: pricer1 });
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should revert if not pricer', async () => {
            await ctx.Tx;
            await ctx.Rates.addSymbol(web3.fromUtf8(symbol2), {from: pricer2})
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe.skip('add symbol with token address', () => {});

    describe.skip('set token address', () => {});

    describe.skip('is token', () => {});

    describe('remove symbol', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';

        beforeEach(async () => {
            await ctx.Rates.addPricer(pricer1);
            await ctx.Rates.addSymbol(web3.fromUtf8(symbol1), {from: pricer1});
            ctx.Tx = ctx.Rates.removeSymbol(web3.fromUtf8(symbol1), {from: pricer1});
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should revert if not pricer', async () => {
            await ctx.Tx;
            await ctx.Rates.addSymbol(web3.fromUtf8(symbol2), {from: pricer1})
            await ctx.Rates.removeSymbol(web3.fromUtf8(symbol2), {from: pricer2})
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe('set price', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';
        const price1 = new BigNumber(10);
        const price2 = new BigNumber(20);

        beforeEach(async () => {
            await ctx.Rates.addPricer(pricer1);
            await ctx.Rates.addSymbol(web3.fromUtf8(symbol1), {from: pricer1});
            ctx.Tx = ctx.Rates.set(web3.fromUtf8(symbol1), price1, {from: pricer1});
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should revert if not pricer', async () => {
            await ctx.Tx;
            await ctx.Rates.set(web3.fromUtf8(symbol1), price2, {from: pricer2})
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should revert if symbols is not exists', async () => {
            await ctx.Tx;
            await ctx.Rates.removeSymbol(web3.fromUtf8(symbol1), {from: pricer1});

            await ctx.Rates.set(web3.fromUtf8(symbol1), price2, {from: pricer1})
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe('get price', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';
        const price1 = new BigNumber(10);
        const price2 = new BigNumber(20);

        beforeEach(async () => {
            await ctx.Rates.addPricer(pricer1);
            await ctx.Rates.addSymbol(web3.fromUtf8(symbol1), {from: pricer1});
            await ctx.Rates.set(web3.fromUtf8(symbol1), price1, {from: pricer1});
            ctx.Tx = ctx.Rates.get(web3.fromUtf8(symbol1));
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should return expected price', async () => {
            const actual = await ctx.Tx;

            actual.should.bignumber.eq(price1);
        });

        it('should revert if symbols is not exists', async () => {
            await ctx.Tx;
            await ctx.Rates.removeSymbol(web3.fromUtf8(symbol1), {from: pricer1});

            await ctx.Rates.get(web3.fromUtf8(symbol1), {from: pricer2})
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });
})
