const utils = require('../../shared/tests/utils.js');
const Token = artifacts.require('WToken');
const getSourceAmount = (amount, tokenToRefundAmount, tokenBoughtAmount) => {
    return utils.round(amount.mul(tokenToRefundAmount).div(tokenBoughtAmount));
};
const getAmount = (sourceAmount, totalFundedAmount, trancheReleasedPercent) => {
    return totalFundedAmount
        .sub(utils.percent(totalFundedAmount, trancheReleasedPercent))
        .mul(sourceAmount)
        .div(totalFundedAmount);
};
// ctx =>
// contract - fund contract
// Tx - () => Promise
// expectedTokenRefundedAmount
// investorAddress
module.exports = (ctx) => {
    it('increase total token refunded amount', async () => {
        const before = await ctx.contract.totalTokenRefunded();

        await ctx.Tx();

        const actual = await ctx.contract.totalTokenRefunded();

        actual.should.bignumber.eq(before.add(ctx.expectedTokenRefundedAmount));
    });

    it('decrease token bought per investor amount for investor', async () => {
        const before = await ctx.contract.getInvestorTokenBoughtAmount(ctx.investorAddress);

        await ctx.Tx();

        const actual = await ctx.contract.getInvestorTokenBoughtAmount(ctx.investorAddress);

        actual.should.bignumber.eq(before.sub(ctx.expectedTokenRefundedAmount));
    });

    it('decrease total funded released amount', async () => {
        const bought = await ctx.contract.getInvestorTokenBoughtAmount(ctx.investorAddress);
        const trancheReleasedPercent = await ctx.contract.totalTranchePercentReleased();
        const list = await Promise.all(
            (await ctx.contract.getInvestorFundedAssetsSymbols(ctx.investorAddress))
                .map(async (s) => ({
                    symbol: s,
                    fundedByInvestor: await ctx.contract.getInvestorFundedAmount(ctx.investorAddress, s),
                    funded: await ctx.contract.getTotalFundedAmount(s),
                    released: await ctx.contract.getTotalFundedReleased(s)
                }))
        );
        await ctx.Tx();

        for (const item of list) {
            const actual = await ctx.contract.getTotalFundedReleased(item.symbol);
            const refunded = getAmount(
                getSourceAmount(item.fundedByInvestor, ctx.expectedTokenRefundedAmount, bought),
                item.funded,
                trancheReleasedPercent
            );

            actual.should.bignumber.eq(item.released.add(refunded));
        }
    });

    it('decrease funded per investor amount for investor', async () => {
        const bought = await ctx.contract.getInvestorTokenBoughtAmount(ctx.investorAddress);
        const trancheReleasedPercent = await ctx.contract.totalTranchePercentReleased();
        const list = await Promise.all(
            (await ctx.contract.getInvestorFundedAssetsSymbols(ctx.investorAddress))
                .map(async (s) => ({
                    symbol: s,
                    fundedByInvestor: await ctx.contract.getInvestorFundedAmount(ctx.investorAddress, s),
                    funded: await ctx.contract.getTotalFundedAmount(s),
                    released: await ctx.contract.getTotalFundedReleased(s)
                }))
        );
        await ctx.Tx();

        for (const item of list) {
            const actual = await ctx.contract.getInvestorFundedAmount(ctx.investorAddress, item.symbol);
            const sourceRefunded = getSourceAmount(item.fundedByInvestor, ctx.expectedTokenRefundedAmount, bought);

            actual.should.bignumber.eq(item.fundedByInvestor.sub(sourceRefunded));
        }
    });

    it('refund assets', async () => {
        const bought = await ctx.contract.getInvestorTokenBoughtAmount(ctx.investorAddress);
        const trancheReleasedPercent = await ctx.contract.totalTranchePercentReleased();
        const list = await Promise.all(
            (await ctx.contract.getInvestorFundedAssetsSymbols(ctx.investorAddress))
                .filter(s => web3.toUtf8(s) !== 'USD')
                .map(async (s) => ({
                    symbol: s,
                    before: web3.toUtf8(s) === 'ETH'
                        ? await web3.eth.getBalance(ctx.investorAddress)
                        : await (await Token.at(await ctx.rates.getTokenAddress(s))).balanceOf(ctx.investorAddress),
                    fundedByInvestor: await ctx.contract.getInvestorFundedAmount(ctx.investorAddress, s),
                    funded: await ctx.contract.getTotalFundedAmount(s),
                    released: await ctx.contract.getTotalFundedReleased(s),
                    isETH: web3.toUtf8(s) === 'ETH'
                }))
        );
        const cost = await utils.getTransactionCost(await ctx.Tx());

        for (const item of list) {
            const actual = item.isETH
                ? (await web3.eth.getBalance(ctx.investorAddress)).add(cost)
                : await (await Token.at(await ctx.rates.getTokenAddress(item.symbol))).balanceOf(ctx.investorAddress);
            const refunded = getAmount(
                getSourceAmount(item.fundedByInvestor, ctx.expectedTokenRefundedAmount, bought),
                item.funded,
                trancheReleasedPercent
            );

            actual.should.bignumber.eq(item.before.add(refunded));
        }
    });

    it('emit events', async () => {
        const bought = await ctx.contract.getInvestorTokenBoughtAmount(ctx.investorAddress);
        const trancheReleasedPercent = await ctx.contract.totalTranchePercentReleased();
        const list = await Promise.all(
            (await ctx.contract.getInvestorFundedAssetsSymbols(ctx.investorAddress))
                .filter(s => web3.toUtf8(s) !== 'USD')
                .map(async (s) => ({
                    symbol: s,
                    fundedByInvestor: await ctx.contract.getInvestorFundedAmount(ctx.investorAddress, s),
                    funded: await ctx.contract.getTotalFundedAmount(s),
                    released: await ctx.contract.getTotalFundedReleased(s)
                }))
        );
        const {logs} = await ctx.Tx();

        for (const item of list) {
            const actual = logs.find(e =>
                e.event === 'AssetRefunded'
                && web3.toUtf8(e.args.symbol) === web3.toUtf8(item.symbol)
            );
            const refunded = getAmount(
                getSourceAmount(item.fundedByInvestor, ctx.expectedTokenRefundedAmount, bought),
                item.funded,
                trancheReleasedPercent
            );


            should.exist(actual);
            actual.args.investor.should.to.be.eq(ctx.investorAddress);
            actual.args.amount.should.bignumber.eq(refunded);
        }

        const actual = logs.find(e =>
            e.event === 'TokenRefunded'
        );

        should.exist(actual);
        actual.args.investor.should.to.be.eq(ctx.investorAddress);
        actual.args.tokenAmount.should.bignumber.eq(ctx.expectedTokenRefundedAmount);
    });
}
