require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const TokenExchanger = artifacts.require('TokenExchanger');
const Token = artifacts.require('WToken');

contract('TokenExchanger', async (accounts) => {
    let sut, ctx = {};

    beforeEach(async () => {
        sut = await TokenExchanger.new(0);
    });

    describe('when called by the owner', async () => {
        it('should add token to listing', async () => {
            const expectedToken = utils.generateRandomAddress();
            const expectedWToken = utils.generateRandomAddress();

            await sut.addTokenToListing(expectedToken, expectedWToken, {from: accounts[0]}).should.be.fulfilled;

            (await sut.hasPair(expectedToken, expectedWToken).should.be.fulfilled).should.be.true;
            (await sut.hasPair(expectedWToken, expectedToken).should.be.fulfilled).should.be.true;
            (await sut.getTokenByWToken(expectedWToken).should.be.fulfilled).should.be.equal(expectedToken);
            (await sut.getWTokenByToken(expectedToken).should.be.fulfilled).should.be.equal(expectedWToken);
        });

        describe('when called with invalid arguments', async () => {
            for (const pair of [
                [utils.ZERO_ADDRESS, utils.generateRandomAddress()],
                [utils.generateRandomAddress(), utils.ZERO_ADDRESS],
                [utils.ZERO_ADDRESS, utils.ZERO_ADDRESS]
            ])
                it(`should reject adding ${pair} of addresses to listing`, async () => {
                    await sut.addTokenToListing(pair[0], pair[1], {from: accounts[1]}).should.be.rejectedWith(utils.EVMRevert);

                    (await sut.hasPair(pair[0], pair[1]).should.be.fulfilled).should.be.false;
                    (await sut.hasPair(pair[1], pair[0]).should.be.fulfilled).should.be.false;
                });
        });
    });

    describe('when called not by the owner', async () => {
        it('should reject adding token to listing', async () => {
            const expectedToken = utils.generateRandomAddress();
            const expectedWToken = utils.generateRandomAddress();

            await sut.addTokenToListing(expectedToken, expectedWToken, {from: accounts[1]}).should.be.rejectedWith(utils.EVMRevert);

            (await sut.hasPair(expectedToken, expectedWToken).should.be.fulfilled).should.be.false;
            (await sut.hasPair(expectedWToken, expectedToken).should.be.fulfilled).should.be.false;
        });
    });

    describe('exchanging', async () => {
        const buyer1 = accounts[4];
        const buyer2 = accounts[5];
        const mint = new BigNumber(100);

        describe('success', async () => {
            beforeEach(async () => {
                ctx.Token = await Token.new('A', 'A', 18);
                ctx.WToken = await Token.new('B', 'B', 18);
                ctx.AnotherWToken = await Token.new('C', 'C', 18);
                ctx.AnotherToken = await Token.new('D', 'D', 18);

                await sut.addTokenToListing(ctx.Token.address, ctx.WToken.address);
                await ctx.Token.mint(sut.address, mint, 0);
                await ctx.WToken.mint(buyer1, mint, 0);
                await ctx.WToken.approve(sut.address, mint, {from: buyer1});

                ctx.Tx = sut.exchange(ctx.WToken.address, mint, {from: buyer1});
            });

            it('should`t revert', async () => {
                await ctx.Tx
                    .should.be.fulfilled;
            });

            it('should send token from exchanger', async () => {
                await ctx.Tx;

                const actual = await ctx.Token.balanceOf(sut.address);

                actual.should.bignumber.eq(0);
            });

            it('should send wtoken from buyer', async () => {
                await ctx.Tx;

                const actual = await ctx.WToken.balanceOf(buyer1);

                actual.should.bignumber.eq(0);
            });

            it('should fill exchanger balance with wtoken', async () => {
                await ctx.Tx;

                const actual = await ctx.WToken.balanceOf(sut.address);

                actual.should.bignumber.eq(mint);
            });

            it('should fill buyer balance with token', async () => {
                await ctx.Tx;

                const actual = await ctx.Token.balanceOf(buyer1);

                actual.should.bignumber.eq(mint);
            });

            it('should emmit event', async () => {
                // Exchange(address indexed from, address indexed to, uint amount, address indexed sender);
                const event = await utils.expectEvent.inLogs((await ctx.Tx).logs, 'Exchange');

                event.args.from.should.eq(ctx.WToken.address);
                event.args.to.should.eq(ctx.Token.address);
                event.args.amount.should.be.bignumber.equal(mint);
                event.args.sender.should.eq(buyer1);
            });
        });


        describe('security', async() => {
            beforeEach(async () => {
                ctx.Token = await Token.new('A', 'A', 18);
                ctx.WToken = await Token.new('B', 'B', 18);
                ctx.AnotherWToken = await Token.new('C', 'C', 18);
                ctx.AnotherToken = await Token.new('D', 'D', 18);

                await sut.addTokenToListing(ctx.Token.address, ctx.WToken.address);
                await ctx.Token.mint(sut.address, mint, 0);
                await ctx.WToken.mint(buyer1, mint, 0);
                await ctx.WToken.approve(sut.address, mint, {from: buyer1});
            });

            it('should revert for unknown wtoken', async () => {
                await ctx.AnotherWToken.mint(buyer1, mint, 0);
                await ctx.AnotherWToken.approve(sut.address, mint, {from: buyer1});

                await sut.exchange(ctx.AnotherWToken.address, mint, {from: buyer1})
                    .should.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if amount is too large', async () => {
                await sut.exchange(ctx.WToken.address, mint.plus(1), {from: buyer1})
                    .should.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if amount is zero', async () => {
                await sut.exchange(ctx.WToken.address, 0, {from: buyer1})
                    .should.be.rejectedWith(utils.EVMRevert);
            });
        });
    });
});
