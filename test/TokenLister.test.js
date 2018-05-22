const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const crypto = require('crypto');

const TokenLister = artifacts.require('TokenLister');
const GenericToken = artifacts.require('GenericToken');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function generateRandomAddress() {
    return `0x${crypto.randomBytes(20).toString('hex')}`;
};

contract('TokenLister', async (accounts) => {
    let sut;
    let token;

    beforeEach(async () => {
        sut = await TokenLister.new();
        token = generateRandomAddress();
    });

    describe('when called by the owner', async () => {
        beforeEach(async () => {
            sut = await TokenLister.new();
        });

        it('should add token to listing', async () => {
            const receipt = await sut.whitelistToken(accounts[1], token, "TestTokenForSale", "TTFS", 18).should.be.fulfilled;

            receipt.logs[0].event.should.be.equal('OwnerWhitelisted');
            receipt.logs[0].args.tokenAddress.should.be.equal(token);
            receipt.logs[0].args.tokenOwner.should.be.equal(accounts[1]);
            receipt.logs[0].args.name.should.be.equal("TestTokenForSale");
            receipt.logs[0].args.symbol.should.be.equal("TTFS");
            receipt.logs[0].args.decimals.should.bignumber.equal(18);
        });

        it('should check that input addresses are not zeros', async () => {
            await sut.whitelistToken(accounts[1], ZERO_ADDRESS, "TestTokenForSale", "TTFS", 18).should.be.rejected;
            await sut.whitelistToken(ZERO_ADDRESS, token, "TestTokenForSale", "TTFS", 18).should.be.rejected;
            await sut.whitelistToken(ZERO_ADDRESS, ZERO_ADDRESS, "TestTokenForSale", "TTFS", 18).should.be.rejected;
        });

        it('should reject add the same token for the same owner multiple times', async () => {
            await sut.whitelistToken(accounts[1], token, "TestTokenForSale", "TTFS", 18).should.be.fulfilled;
            await sut.whitelistToken(accounts[1], token, "TestTokenForSale", "TTFS", 18).should.be.rejected;
        });

        it('should allow to add the same token for different owners', async () => {
            await sut.whitelistToken(accounts[1], token, "TestTokenForSale", "TTFS", 18).should.be.fulfilled;
            await sut.whitelistToken(accounts[2], token, "TestTokenForSale", "TTFS", 18).should.be.fulfilled;
        });

        it('should allow to add different tokens for the same owner', async () => {
            await sut.whitelistToken(accounts[1], generateRandomAddress(), "TestTokenForSale", "TTFS", 18).should.be.fulfilled;
            await sut.whitelistToken(accounts[1], generateRandomAddress(), "TestTokenForSale", "TTFS", 18).should.be.fulfilled;
        });

        describe('when token are listed', async () => {
            let tokenOwner = accounts[1];

            beforeEach(async () => {
                sut = await TokenLister.new();
                token = await GenericToken.new('TestToken', 'TT', 18);
                await sut.whitelistToken(tokenOwner, token.address, "TestTokenz", "TT", 18);
                await token.mint(accounts[1], 10000);
                await token.approve(sut.address, 10000);
            });

            it('should create an exchangable token', async () => {
                const tokenAmountForSale = new BigNumber(10).pow(18).mul(10000);
                const receipt = await sut.placeToken(token.address, tokenAmountForSale, { from: accounts[1] }).should.be.fulfilled;

                receipt.logs[0].event.should.be.equal('TokenPlaced');
                receipt.logs[0].args.originalTokenAddress.should.be.equal(token.address);
                receipt.logs[0].args.tokenAmount.should.bignumber.equal(tokenAmountForSale);
                receipt.logs[0].args.placedTokenAddress.should.be.not.empty();

                const actualExchangerBalance = await token.balanceOf(await sut.address).should.be.fulfilled;

                actualExchangerBalance.should.bignumber.equal(tokenAmountForSale);
            });
        });
    });

    describe('when called not by the owner', async () => {
        beforeEach(async () => {
            sut = await TokenLister.new({from: accounts[9]});
        });

        it('should reject whitelisting a token', async () => {
            await sut.whitelistToken(accounts[1], token).should.be.rejected;
        });
    });
});
