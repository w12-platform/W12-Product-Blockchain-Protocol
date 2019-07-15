const utils = require('../../shared/tests/utils.js');
const getSourceAmount = (tranchePercent, totalFundedAmount) => {
    return utils.percent(totalFundedAmount, tranchePercent);
};
const getAmount = (sourceAmount, totalTokenRefundedAmount, totalTokenBought) => {
    return totalTokenBought
        .sub(totalTokenRefundedAmount)
        .mul(sourceAmount)
        .div(totalTokenBought);
};

// ctx =>
// contract - fund contract
// Tx - () => Promise
// milestoneIndex
// expectedTranchePercent
// expectedTotalTranchePercentReleased
// expectedTrancheFeePercent
// serviceWalletAddress
// fundOwner
// token - instance of payment token
module.exports = (ctx) => {
    it('complete tranche', async () => {
        await ctx.Tx();

        const actual = await ctx.contract.completedTranches(ctx.milestoneIndex);

        actual.should.to.be.true;
    });

    it('increase total tranche percent released', async () => {
        await ctx.Tx();

        const actual = await ctx.contract.totalTranchePercentReleased();

        actual.should.bignumber.eq(ctx.expectedTotalTranchePercentReleased);
    });

    it('increase total funded released amount', async () => {
        const symbols = await ctx.contract.getTotalFundedAssetsSymbols();
        const bought = await ctx.contract.totalTokenBought();
        const refunded = await ctx.contract.totalTokenRefunded();
        const list = await Promise.all(
            symbols
                .filter(s => web3.toUtf8(s) !== 'USD')
                .map(async s => ({
                    symbol: s,
                    before: await ctx.contract.getTotalFundedReleased(s),
                    funded: (await ctx.contract.getTotalFundedAmount(s))
                }))
        );

        await ctx.Tx();

        for (const item of list) {
            const actual = await ctx.contract.getTotalFundedReleased(item.symbol);
            const expected = getAmount(
                getSourceAmount(ctx.expectedTranchePercent, item.funded),
                refunded,
                bought
            );

            actual.should.bignumber.eq(item.before.add(expected));
        }
    });

    it('got fee on service wallet', async () => {
        const symbols = await ctx.contract.getTotalFundedAssetsSymbols();
        const bought = await ctx.contract.totalTokenBought();
        const refunded = await ctx.contract.totalTokenRefunded();
        const list = await Promise.all(
            symbols
                .filter(s => web3.toUtf8(s) !== 'USD')
                .map(async s => ({
                    symbol: s,
                    funded: await ctx.contract.getTotalFundedAmount(s),
                    before: web3.toUtf8(s) === 'ETH'
                        ? await web3.eth.getBalance(ctx.serviceWalletAddress)
                        : await ctx.token.balanceOf(ctx.serviceWalletAddress)
                }))
        );

        await ctx.Tx();

        for (const item of list) {
            const actual = web3.toUtf8(item.symbol) === 'ETH'
                ? await web3.eth.getBalance(ctx.serviceWalletAddress)
                : await ctx.token.balanceOf(ctx.serviceWalletAddress);

            const released = getAmount(
                getSourceAmount(ctx.expectedTranchePercent, item.funded),
                refunded,
                bought
            );
            const fee = utils.percent(released, ctx.expectedTrancheFeePercent);

            actual.should.bignumber.eq(item.before.add(fee));
        }
    });

    it('got assets on owner wallet', async () => {
        const symbols = await ctx.contract.getTotalFundedAssetsSymbols();
        const bought = await ctx.contract.totalTokenBought();
        const refunded = await ctx.contract.totalTokenRefunded();
        const list = await Promise.all(
            symbols
                .filter(s => web3.toUtf8(s) !== 'USD')
                .map(async s => ({
                    symbol: s,
                    funded: await ctx.contract.getTotalFundedAmount(s),
                    before: web3.toUtf8(s) === 'ETH'
                        ? await web3.eth.getBalance(ctx.fundOwner)
                        : await ctx.token.balanceOf(ctx.fundOwner)
                }))
        );

        const cost = await utils.getTransactionCost(await ctx.Tx());

        for (const item of list) {
            const actual = web3.toUtf8(item.symbol) === 'ETH'
                ? await web3.eth.getBalance(ctx.fundOwner)
                : await ctx.token.balanceOf(ctx.fundOwner);

            const released = getAmount(
                getSourceAmount(ctx.expectedTranchePercent, item.funded),
                refunded,
                bought
            );
            const fee = utils.percent(released, ctx.expectedTrancheFeePercent);
            let expected = item.before.add(released.sub(fee));

            if (web3.toUtf8(item.symbol) === 'ETH') expected = expected.sub(cost);

            actual.should.bignumber.eq(expected);
        }
    });

    it('emit events', async () => {
        const symbols = await ctx.contract.getTotalFundedAssetsSymbols();
        const bought = await ctx.contract.totalTokenBought();
        const refunded = await ctx.contract.totalTokenRefunded();
        const list = await Promise.all(
            symbols
                .filter(s => web3.toUtf8(s) !== 'USD')
                .map(async s => ({
                    symbol: s,
                    funded: await ctx.contract.getTotalFundedAmount(s)
                }))
        );

        const logs = (await ctx.Tx()).logs;

        for (const item of list) {
            const actual = logs.find(e =>
                e.event === 'TrancheTransferred'
                && web3.toUtf8(e.args.symbol) === web3.toUtf8(item.symbol)
            );
            const released = getAmount(
                getSourceAmount(ctx.expectedTranchePercent, item.funded),
                refunded,
                bought
            );;

            should.exist(actual);
            actual.args.receiver.should.to.be.eq(ctx.fundOwner);
            actual.args.amount.should.bignumber.eq(released);
        }

        const actual = logs.find(e =>
            e.event === 'TrancheReleased'
        );

        should.exist(actual);
        actual.args.receiver.should.to.be.eq(ctx.fundOwner);
        actual.args.percent.should.bignumber.eq(ctx.expectedTranchePercent);
    });
}
