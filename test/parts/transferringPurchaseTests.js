const utils = require('../../shared/tests/utils.js');

const defaultProcess = (
    ctx
    // {
    //     Tx
    //     expectedWTokenAmount,
    //     expectedFee,
    //     originToken,
    //     WToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress,
    //     investorAddress
    // }
) => {

    it('should send wtoken from contract', async () => {
        const before = await ctx.WToken.balanceOf(ctx.contractAddress);

        await ctx.Tx();

        const actual = await ctx.WToken.balanceOf(ctx.contractAddress);

        actual.should.bignumber.eq(before.minus(ctx.expectedWTokenAmount).minus(ctx.expectedFee[0]));
    });

    it('should send wtoken to investor balance', async () => {
        const before = await ctx.WToken.balanceOf(ctx.investorAddress);

        await ctx.Tx();

        const actual = await ctx.WToken.balanceOf(ctx.investorAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedWTokenAmount));
    });
}

const whenPaymentWithToken = (
    ctx
    // {
    //     Tx
    //     expectedPaymentTokenAmount,
    //     expectedFee,
    //     originToken,
    //     WToken,
    //     PaymentToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress,
    //     investorAddress
    //     paymentDestinationAddress
    // }
) => {

    it('should send payment token minus change to destination address', async () => {
        const before = await ctx.PaymentToken.balanceOf(ctx.paymentDestinationAddress);

        await ctx.Tx();

        const actual = await ctx.PaymentToken.balanceOf(ctx.paymentDestinationAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedPaymentTokenAmount));
    });

    it('should send payment token from investor balance and get change', async () => {
        const before = await ctx.PaymentToken.balanceOf(ctx.investorAddress);

        await ctx.Tx();

        const actual = await ctx.PaymentToken.balanceOf(ctx.investorAddress);

        actual.should.bignumber.eq(before.minus(ctx.expectedPaymentTokenAmount).minus(ctx.expectedFee[1]));
    });
}

const whenPaymentWithETH = (
    ctx
    // {
    //     Tx
    //     expectedPaymentETHAmount,
    //     paymentDestinationAddress,
    //     expectedFee,
    //     originToken,
    //     WToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress,
    //     investorAddress
    // }
) => {

    it('should send eth minus change to destination balance', async () => {
        const before = await web3.eth.getBalance(ctx.paymentDestinationAddress);

        await ctx.Tx();

        const actual = await web3.eth.getBalance(ctx.paymentDestinationAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedPaymentETHAmount));
    });

    it('should send eth from investor balance and get change', async () => {
        const before = await web3.eth.getBalance(ctx.investorAddress);

        const cost = await utils.getTransactionCost(await ctx.Tx());

        const actual = await web3.eth.getBalance(ctx.investorAddress);

        actual.should.bignumber.eq(before.minus(cost).minus(ctx.expectedPaymentETHAmount).minus(ctx.expectedFee[1]));
    });
}

module.exports = {
    defaultProcess,
    whenPaymentWithToken,
    whenPaymentWithETH
}
