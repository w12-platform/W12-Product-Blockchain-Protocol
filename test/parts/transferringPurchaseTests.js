const utils = require('../../shared/tests/utils.js');

const purchaseTransfer = (
    ctx
    // {
    //     Tx
    //     expectedWTokenAmount,
    //     originToken,
    //     WToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress,
    //     investorAddress
    // }
) => {

    it('should`t revert', async () => {
        await ctx.Tx()
            .should.to.be.fulfilled;
    });

    it('should send wtoken from contract', async () => {
        const before = await ctx.WToken.balanceOf(ctx.contractAddress);

        await ctx.Tx();

        const actual = await ctx.WToken.balanceOf(ctx.contractAddress);

        actual.should.bignumber.eq(before.minus(ctx.expectedWTokenAmount));
    });

    it('should send wtoken to investor balance', async () => {
        const before = await ctx.WToken.balanceOf(ctx.investorAddress);

        await ctx.Tx();

        const actual = await ctx.WToken.balanceOf(ctx.investorAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedWTokenAmount));
    });
}

const paymentInTokenTransfer = (
    ctx
    // {
    //     Tx
    //     expectedPaymentTokenAmount,
    //     originToken,
    //     WToken,
    //     PaymentToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress,
    //     investorAddress
    // }
) => {

    it('should`t revert', async () => {
        await ctx.Tx()
            .should.to.be.fulfilled;
    });

    it('should send payment token minus change to contract balance', async () => {
        const before = await ctx.PaymentToken.balanceOf(ctx.contractAddress);

        await ctx.Tx();

        const actual = await ctx.PaymentToken.balanceOf(ctx.contractAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedPaymentTokenAmount));
    });

    it('should send payment token from investor balance and get change', async () => {
        const before = await ctx.PaymentToken.balanceOf(ctx.investorAddress);

        await ctx.Tx();

        const actual = await ctx.PaymentToken.balanceOf(ctx.investorAddress);

        actual.should.bignumber.eq(before.minus(ctx.expectedPaymentTokenAmount));
    });
}

const paymentInETHTransfer = (
    ctx
    // {
    //     Tx
    //     expectedPaymentETHAmount,
    //     originToken,
    //     WToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress,
    //     investorAddress
    // }
) => {

    it('should`t revert', async () => {
        await ctx.Tx()
            .should.to.be.fulfilled;
    });

    it('should send eth minus change to contract balance', async () => {
        const before = await web3.eth.getBalance(ctx.contractAddress);

        await ctx.Tx();

        const actual = await web3.eth.getBalance(ctx.contractAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedPaymentETHAmount));
    });

    it('should send eth from investor balance and get change', async () => {
        const before = await web3.eth.getBalance(ctx.investorAddress);

        const cost = await utils.getTransactionCost(await ctx.Tx());

        const actual = await web3.eth.getBalance(ctx.investorAddress);

        actual.should.bignumber.eq(before.minus(cost).minus(ctx.expectedPaymentETHAmount));
    });
}

module.exports = {
    purchaseTransfer,
    paymentInTokenTransfer,
    paymentInETHTransfer
}
