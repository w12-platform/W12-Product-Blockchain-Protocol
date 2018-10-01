require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const Symbols = artifacts.require('Symbols');

contract('Symbols', async (accounts) => {
    const ctx = {};

    beforeEach(async () => {
        ctx.Symbols = await Symbols.new();
    });

    describe('add symbols', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';

        beforeEach(async () => {
            ctx.Tx = ctx.Symbols.addSymbol(web3.fromUtf8(symbol1));
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should add another', async () => {
            await ctx.Tx;
            await ctx.Symbols.addSymbol(web3.fromUtf8(symbol2))
                .should.be.fulfilled;
        });

        it('should revert', async () => {
            await ctx.Tx;
            await ctx.Symbols.addSymbol(web3.fromUtf8(symbol1))
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe('remove symbols', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';

        beforeEach(async () => {
            await ctx.Symbols.addSymbol(web3.fromUtf8(symbol1));

            ctx.Tx = ctx.Symbols.removeSymbol(web3.fromUtf8(symbol1));
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should revert', async () => {
            await ctx.Tx;
            await ctx.Symbols.removeSymbol(web3.fromUtf8(symbol1))
                .should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe('has', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';

        beforeEach(async () => {
            await ctx.Symbols.addSymbol(web3.fromUtf8(symbol1));

            ctx.Tx = ctx.Symbols.hasSymbol(web3.fromUtf8(symbol1));
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should be true', async () => {
            const actual = await ctx.Tx;

            actual.should.be.true;
        });

        it('should be false', async () => {
            await ctx.Tx;
            const actual = await ctx.Symbols.hasSymbol(web3.fromUtf8(symbol2));

            actual.should.be.false;
        });

        it('should be false if remove', async () => {
            await ctx.Tx;
            await ctx.Symbols.removeSymbol(web3.fromUtf8(symbol1));

            const actual = await ctx.Symbols.hasSymbol(web3.fromUtf8(symbol1));

            actual.should.be.false;
        });
    });

    describe('list', async () => {
        const symbol1 = 'a';
        const symbol2 = 'b';

        beforeEach(async () => {
            await ctx.Symbols.addSymbol(web3.fromUtf8(symbol1));

            ctx.Tx = ctx.Symbols.getSymbolsList();
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.be.fulfilled;
        });

        it('should include', async () => {
            const actual = await ctx.Tx;

            actual.should.to.be.an('array');
            actual.map(i => web3.toUtf8(i)).should.to.includes(symbol1);
        });

        it('should include two symbols', async () => {
            await ctx.Tx;
            await ctx.Symbols.addSymbol(web3.fromUtf8(symbol2));

            const actual = await ctx.Symbols.getSymbolsList();

            actual.should.to.be.an('array');
            actual.map(i => web3.toUtf8(i)).should.to.includes(symbol1);
            actual.map(i => web3.toUtf8(i)).should.to.includes(symbol2);
        });

        it('should`t include', async () => {
            await ctx.Tx;
            await ctx.Symbols.removeSymbol(web3.fromUtf8(symbol1));

            const actual = await ctx.Symbols.getSymbolsList();

            actual.should.to.be.an('array');
            actual.map(i => web3.toUtf8(i)).should.to.not.includes(symbol1);
        });
    });
})
