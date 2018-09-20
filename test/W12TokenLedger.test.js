require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const W12TokenLedger = artifacts.require('W12TokenLedger');

contract('W12TokenLedger', async (accounts) => {
    let sut;

    beforeEach(async () => {
        sut = await W12TokenLedger.new(0);
    });

    describe('when called by the owner', async () => {
        it('should add token to listing', async () => {
            const expectedToken = utils.generateRandomAddress();
            const expectedWToken = utils.generateRandomAddress();

            await sut.addTokenToListing(expectedToken, expectedWToken, { from: accounts[0] }).should.be.fulfilled;

            (await sut.hasPair(expectedToken, expectedWToken).should.be.fulfilled).should.be.true;
            (await sut.hasPair(expectedWToken, expectedToken).should.be.fulfilled).should.be.true;
            (await sut.getTokenByWToken(expectedWToken).should.be.fulfilled).should.be.equal(expectedToken);
            (await sut.getWTokenByToken(expectedToken).should.be.fulfilled).should.be.equal(expectedWToken);
        });

        describe('when called with invalid arguments', async () => {
            for(const pair of [
                [utils.ZERO_ADDRESS, utils.generateRandomAddress()],
                [utils.generateRandomAddress(), utils.ZERO_ADDRESS],
                [utils.ZERO_ADDRESS, utils.ZERO_ADDRESS]
            ])
                it(`should reject adding ${pair} of addresses to listing`, async () => {
                    await sut.addTokenToListing(pair[0], pair[1], { from: accounts[1] }).should.be.rejectedWith(utils.EVMRevert);

                    (await sut.hasPair(pair[0], pair[1]).should.be.fulfilled).should.be.false;
                    (await sut.hasPair(pair[1], pair[0]).should.be.fulfilled).should.be.false;
                });
        });
    });

    describe('when called not by the owner', async () => {
        it('should reject adding token to listing', async () => {
            const expectedToken = utils.generateRandomAddress();
            const expectedWToken = utils.generateRandomAddress();

            await sut.addTokenToListing(expectedToken, expectedWToken, { from: accounts[1] }).should.be.rejectedWith(utils.EVMRevert);

            (await sut.hasPair(expectedToken, expectedWToken).should.be.fulfilled).should.be.false;
            (await sut.hasPair(expectedWToken, expectedToken).should.be.fulfilled).should.be.false;
        });
    });
});
