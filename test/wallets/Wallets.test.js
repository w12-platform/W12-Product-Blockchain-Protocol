require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const Wallets = artifacts.require('Wallets');

contract('Wallets', async (accounts) => {
    const ctx = {};
    const randomAddress = utils.generateRandomAddress();

    before(async () => {
        ctx.Wallets = await Wallets.new();
    });

    it('should set wallet address for id 2', async () => {
        ctx.Tx = await ctx.Wallets.setWallet(2, randomAddress)
            .should.to.be.fulfilled;
    });

    it('should get wallet address for id 2', async () => {
        const actual = await ctx.Wallets.getWallet(2);

        actual.should.to.be.eq(randomAddress);
    });

    it('should emmit event', async () => {
        const event = await utils.expectEvent.inLogs(ctx.Tx.logs, 'NewWallet');

        event.args.ID.should.bignumber.eq(2);
        event.args.wallet.should.to.be.eq(randomAddress);
    });
});
