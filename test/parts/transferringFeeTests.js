const defaultProcess = (
    ctx
    // {
    //     Tx
    //     expectedFee,
    //     originToken,
    //     WToken,
    //     PaymentToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress
    // }
) => {

    it('should send fee to service wallet in project token', async () => {
        const before = await ctx.originToken.balanceOf(ctx.serviceWalletAddress);

        await ctx.Tx();

        const actual = await ctx.originToken.balanceOf(ctx.serviceWalletAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedFee[0]));
    });

    it('should send fee from exchanger in project token', async () => {
        const before = await ctx.originToken.balanceOf(ctx.exchangerAddress);

        await ctx.Tx();

        const actual = await ctx.originToken.balanceOf(ctx.exchangerAddress);

        actual.should.bignumber.eq(before.minus(ctx.expectedFee[0]));
    });

    it('should send wtoken to exchanger for maintaining balance', async () => {
        const before = await ctx.WToken.balanceOf(ctx.exchangerAddress);

        await ctx.Tx();

        const actual = await ctx.WToken.balanceOf(ctx.exchangerAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedFee[0]));
    });
}

const whenPaymentWithToken = (
    ctx
    // {
    //     Tx
    //     expectedFee,
    //     originToken,
    //     WToken,
    //     PaymentToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress
    // }
) => {

    it('should send fee to service wallet in payment token', async () => {
        const before = await ctx.PaymentToken.balanceOf(ctx.serviceWalletAddress);

        await ctx.Tx();

        const actual = await ctx.PaymentToken.balanceOf(ctx.serviceWalletAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedFee[1]));
    });
}

const whenPaymentWithETH = (
    ctx
    // {
    //     Tx
    //     expectedFee,
    //     originToken,
    //     WToken,
    //     contractAddress,
    //     exchangerAddress,
    //     serviceWalletAddress
    // }
) => {

    it('should send fee to service wallet in eth', async () => {
        const before = await web3.eth.getBalance(ctx.serviceWalletAddress);

        await ctx.Tx();

        const actual = await web3.eth.getBalance(ctx.serviceWalletAddress);

        actual.should.bignumber.eq(before.plus(ctx.expectedFee[1]));
    });
}

module.exports = {
    defaultProcess,
    whenPaymentWithToken,
    whenPaymentWithETH
}
