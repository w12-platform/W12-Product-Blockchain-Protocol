const utils = require('../../shared/tests/utils.js');

// ctx =>
// contract - fund cotract
// Tx - record purchase promise
// expectedTotalBoughtTokenAmount
// expectedTotalFundedAmount
// expectedTotalFundedUSDAmount
// expectedInvestorTokenBoughtAmount
// expectedInvestorTotalTokenBoughtAmount
// expectedCostAmount
// expectedFundedAmount
// expectedFundedUSDAmount
// expectedTotalFundedAssetsSymbols
// expectedFundedAssetsSymbols
// investorAddress
// Symbol
module.exports = (ctx) => {
    it('increase total token bought amount', async () => {
        await ctx.Tx;

        const actual = await ctx.contract.totalTokenBought();

        actual.should.bignumber.eq(ctx.expectedTotalBoughtTokenAmount);
    });

    it('increase total funded under token symbol', async () => {
        await ctx.Tx;

        const actual = await ctx.contract.getTotalFundedAmount(web3.fromUtf8(ctx.Symbol));

        actual.should.bignumber.eq(ctx.expectedTotalFundedAmount);
    });

    it('increase total funded under USD symbol', async () => {
        await ctx.Tx;

        const actual = await ctx.contract.getTotalFundedAmount(web3.fromUtf8('USD'));

        actual.should.bignumber.eq(ctx.expectedTotalFundedUSDAmount);
    });

    it('increase token bought amount for investor', async () => {
        await ctx.Tx;

        const actual = await ctx.contract.getInvestorTokenBoughtAmount(ctx.investorAddress);

        actual.should.bignumber.eq(ctx.expectedInvestorTotalTokenBoughtAmount);
    });

    it('increase funded amount under token symbol for investor', async () => {
        await ctx.Tx;

        const actual = await ctx.contract.getInvestorFundedAmount(ctx.investorAddress, web3.fromUtf8(ctx.Symbol));

        actual.should.bignumber.eq(ctx.expectedFundedAmount);
    });

    it('increase funded amount under USD symbol for investor', async () => {
        await ctx.Tx;

        const actual = await ctx.contract.getInvestorFundedAmount(ctx.investorAddress, web3.fromUtf8('USD'));

        actual.should.bignumber.eq(ctx.expectedFundedUSDAmount);
    });

    it('add symbols to list of total funded assets', async () => {
        await ctx.Tx;

        let actual = await ctx.contract.getTotalFundedAssetsSymbols();

        actual.should.to.be.a('array');
        actual = actual.map(s => web3.toUtf8(s));

        for(const symbol of ctx.expectedTotalFundedAssetsSymbols) {
            actual.should.to.include(symbol);
        }
    });

    it('add symbols to list of total funded assets for investor', async () => {
        await ctx.Tx;

        let actual = await ctx.contract.getInvestorFundedAssetsSymbols(ctx.investorAddress);

        actual.should.to.be.a('array');
        actual = actual.map(s => web3.toUtf8(s));

        for (const symbol of ctx.expectedFundedAssetsSymbols) {
            actual.should.to.include(symbol);
        }
    });

    it('emit event', async () => {
        const event = await utils.expectEvent.inLogs((await ctx.Tx).logs, 'FundsReceived');

        event.args.investor.should.to.be.eq(ctx.investorAddress);
        event.args.tokenAmount.should.bignumber.eq(ctx.expectedInvestorTokenBoughtAmount);
        web3.toUtf8(event.args.symbol).should.to.be.eq(ctx.Symbol);
        event.args.cost.should.bignumber.eq(ctx.expectedCostAmount);
    });
}
