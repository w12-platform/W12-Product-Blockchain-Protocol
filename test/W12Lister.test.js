require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const W12Lister = artifacts.require('W12Lister');
const W12AtomicSwap = artifacts.require('W12AtomicSwap');
const W12TokenLedger = artifacts.require('W12TokenLedger');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12FundFactory = artifacts.require('W12FundFactory');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const WToken = artifacts.require('WToken');

const oneToken = new BigNumber(10).pow(18);

contract('W12Lister', async (accounts) => {
    let sut;
    let token;
    let factory;
    let fundFactory;
    let lastDate;
    let swap;
    const wallet = accounts[9];
    const oneToken = new BigNumber(10).pow(18);

    beforeEach(async () => {
        const ledger = await W12TokenLedger.new();
        swap = await W12AtomicSwap.new(ledger.address);

        fundFactory = await W12FundFactory.new();
        factory = await W12CrowdsaleFactory.new(fundFactory.address);
        sut = await W12Lister.new(wallet, factory.address, ledger.address, swap.address);

        await ledger.transferOwnership(sut.address);
        await swap.transferOwnership(sut.address);

        token = await WToken.new('TestToken', 'TT', 18);
        lastDate = web3.eth.getBlock('latest').timestamp;
    });

    describe('when called by the owner', async () => {
        it('should initialize wallet with supplied address', async () => {
            const actualWalletAddress = await sut.serviceWallet().should.be.fulfilled;

            actualWalletAddress.should.be.equal(wallet);
        });

        it('should add token to listing', async () => {
            const whitelistedTokensCountBefore = await sut.approvedTokensLength().should.be.fulfilled;

            const receipt = await sut.whitelistToken(
                accounts[1],
                token.address,
                "TestTokenForSale",
                "TTFS",
                18,
                5 * 100,
                5 * 100,
                5 * 100,
                5 * 100,
            ).should.be.fulfilled;

            (await sut.approvedTokensLength()).should.bignumber.equal(whitelistedTokensCountBefore + 1);

            receipt.logs[0].event.should.be.equal('OwnerWhitelisted');
            receipt.logs[0].args.tokenAddress.should.be.equal(token.address);
            receipt.logs[0].args.tokenOwner.should.be.equal(accounts[1]);
            receipt.logs[0].args.name.should.be.equal("TestTokenForSale");
            receipt.logs[0].args.symbol.should.be.equal("TTFS");
        });

        it('should check that input addresses are not zeros', async () => {
            await sut.whitelistToken(accounts[1], utils.ZERO_ADDRESS, "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.rejected;
            await sut.whitelistToken(utils.ZERO_ADDRESS, token.address, "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.rejected;
            await sut.whitelistToken(utils.ZERO_ADDRESS, utils.ZERO_ADDRESS, "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.rejected;
        });

        it('should reject add the same token for the same owner multiple times', async () => {
            await sut.whitelistToken(accounts[1], token.address, "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.fulfilled;
            await sut.whitelistToken(accounts[1], token.address, "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.rejected;
        });

        it('should allow to add the same token for different owners', async () => {
            await sut.whitelistToken(accounts[1], token.address, "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.fulfilled;
            await sut.whitelistToken(accounts[2], token.address, "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.fulfilled;
        });

        it('should allow to add different tokens for the same owner', async () => {
            await sut.whitelistToken(accounts[1], utils.generateRandomAddress(), "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.fulfilled;
            await sut.whitelistToken(accounts[1], utils.generateRandomAddress(), "TestTokenForSale", "TTFS", 18, 5 * 100, 5 * 100, 5 * 100, 5 * 100).should.be.fulfilled;
        });

        describe('when token is listed', async () => {
            let tokenOwner1 = accounts[1];
            let tokenOwner2 = accounts[2];

            const owners = [tokenOwner1, tokenOwner2];

            beforeEach(async () => {
                await sut.whitelistToken(tokenOwner1, token.address, "TestTokenz1", "TT1", 18, 30 * 100, 30 * 100, 5 * 100, 5 * 100);
                await sut.whitelistToken(tokenOwner2, token.address, "TestTokenz2", "TT2", 18, 40 * 100, 40 * 100, 5 * 100, 5 * 100);

                await token.mint(tokenOwner1, oneToken.mul(10000), 0);
                await token.approve(sut.address, oneToken.mul(10000), {from: tokenOwner1});

                await token.mint(tokenOwner2, oneToken.mul(10000), 0);
                await token.approve(sut.address, oneToken.mul(10000), {from: tokenOwner2});
            });

            it('should place token to exchange for owner 1', async () => {
                const placementReceipt = await sut.placeToken(
                    token.address,
                    oneToken.mul(10),
                    {from: tokenOwner1}
                ).should.be.fulfilled;

                placementReceipt.logs[0].event.should.be.equal('TokenPlaced');
                placementReceipt.logs[0].args.originalTokenAddress.should.be.equal(token.address);
                placementReceipt.logs[0].args.tokenOwner.should.be.equal(tokenOwner1);
                placementReceipt.logs[0].args.tokenAmount.should.bignumber.equal(oneToken.mul(7));
                placementReceipt.logs[0].args.placedTokenAddress.should.not.be.equal(utils.ZERO_ADDRESS);

                const swapAddress = await sut.swap();
                const serviceWalletAddress = await sut.serviceWallet();
                const actualExchangerBalance = await token.balanceOf(swapAddress);
                const actualServiceWalletBalance = await token.balanceOf(serviceWalletAddress);

                actualExchangerBalance.should.bignumber.equal(oneToken.mul(7));
                actualServiceWalletBalance.should.bignumber.equal(oneToken.mul(3));
            });

            it('should place token to exchange for owner 2', async () => {
                const placementReceipt = await sut.placeToken(
                    token.address,
                    oneToken.mul(10),
                    {from: tokenOwner2}
                ).should.be.fulfilled;

                placementReceipt.logs[0].event.should.be.equal('TokenPlaced');
                placementReceipt.logs[0].args.originalTokenAddress.should.be.equal(token.address);
                placementReceipt.logs[0].args.tokenOwner.should.be.equal(tokenOwner2);
                placementReceipt.logs[0].args.tokenAmount.should.bignumber.equal(oneToken.mul(6));
                placementReceipt.logs[0].args.placedTokenAddress.should.not.be.equal(utils.ZERO_ADDRESS);

                const swapAddress = await sut.swap();
                const serviceWalletAddress = await sut.serviceWallet();
                const actualExchangerBalance = await token.balanceOf(swapAddress);
                const actualServiceWalletBalance = await token.balanceOf(serviceWalletAddress);

                actualExchangerBalance.should.bignumber.equal(oneToken.mul(6));
                actualServiceWalletBalance.should.bignumber.equal(oneToken.mul(4));
            });
        });
    });

    describe('when called not by the owner', async () => {
        const fromSystemAccount = { from: accounts[0] };
        const fromTokenOwner = { from: accounts[1] };

        it('should reject whitelisting a token', async () => {
            await sut.whitelistToken(
                utils.generateRandomAddress(), utils.generateRandomAddress()
                ,"", "", 1
                , 1 * 100, 1 * 100, 1 * 100, 1 * 100
                , {from: accounts[2]}).should.be.rejected;
        });

        describe('running crowdsale', async () => {
            const placedAmount = oneToken.mul(10);
            const buyCommissionInTokens = new BigNumber(5);
            const placeCommissionInTokens = new BigNumber(30);

            beforeEach(async () => {
                await sut.whitelistToken(
                    fromTokenOwner.from, token.address
                    , "TestTokenz", "TT", 18
                    , placeCommissionInTokens.mul(100), 30 * 100, buyCommissionInTokens.mul(100), 10 * 100
                    , fromSystemAccount);

                await token.mint(fromTokenOwner.from, oneToken.mul(10000), 0, fromSystemAccount);
                await token.approve(sut.address, oneToken.mul(10000), fromTokenOwner);

                await sut.placeToken(token.address, placedAmount, fromTokenOwner).should.be.fulfilled;
            });

            describe('initialization', async () => {
                const saleAmount = oneToken.mul(7);
                const price = oneToken;
                let txReceipt;
                let logs;

                beforeEach(async () => {
                    txReceipt = await sut.initCrowdsale(
                        token.address,
                        saleAmount,
                        price,
                        fromTokenOwner
                    ).should.be.fulfilled;

                    logs = txReceipt.logs;
                });

                it('should be initialized', async () => {
                    const crowdsaleAddress = await sut.getTokenCrowdsale(token.address, fromTokenOwner.from)
                        .should.be.fulfilled;

                    crowdsaleAddress.should.not.be.equal(utils.ZERO_ADDRESS);
                });

                it('should be approved to spend token from swap address for commission', async () => {
                    const crowdsaleAddress = await sut.getTokenCrowdsale(token.address, fromTokenOwner.from);

                    const expectedCrowdsaleSwapAllowance = saleAmount
                        .mul(buyCommissionInTokens.div(100));

                    (await token.allowance(swap.address, crowdsaleAddress))
                        .should.bignumber.eq(expectedCrowdsaleSwapAllowance);
                });

                it('should emmit `CrowdsaleTokenMinted`', async () => {
                    const event = utils.expectEvent.inLogs(logs, 'CrowdsaleTokenMinted');

                    event.args.tokenAddress.should.eq(token.address);
                    event.args.tokenOwner.should.eq(fromTokenOwner.from);
                    event.args.amount.should.be.bignumber.equal(saleAmount);
                });

                describe('shouldn\'t be able to initialize crowdsale with amount of tokens greater than placed', async () => {
                    const invalidAmounts = [
                        oneToken.mul(7.1),
                        oneToken.mul(10),
                        oneToken.mul(-1)
                    ];

                    for (const amount of invalidAmounts) {
                        it(`when amount is equal to ${amount.toNumber()}`, async () => {
                            await sut.initCrowdsale(
                                token.address,
                                amount,
                                oneToken,
                                fromTokenOwner
                            ).should.be.rejectedWith(utils.EVMRevert);
                        })
                    }
                });
            });

            describe('when crowdsale is inited', async () => {
                let crowdsaleAddress;

                beforeEach(async () => {
                    await sut.initCrowdsale(
                        token.address,
                        oneToken.mul(6.9),
                        oneToken,
                        fromTokenOwner
                    ).should.be.fulfilled;

                    crowdsaleAddress = await sut.getTokenCrowdsale(token.address, fromTokenOwner.from);
                });

                it('should be able to add tokens to existed crowdsale', async () => {
                    const crowdsaleAddressBefore = crowdsaleAddress;

                    await sut.addTokensToCrowdsale(
                            token.address,
                            oneToken.mul(0.1),
                            fromTokenOwner
                        ).should.be.fulfilled;

                    const crowdsaleAddressAfter = await sut.getTokenCrowdsale(token.address, fromTokenOwner.from);

                    crowdsaleAddressBefore.should.be.equal(crowdsaleAddressAfter);
                });

                it('shouldn\'t be able to re-initialize crowdsale', async () => {
                    await sut.initCrowdsale(
                        token.address,
                        oneToken.mul(1),
                        oneToken,
                        fromTokenOwner
                    ).should.be.rejectedWith(utils.EVMRevert);
                });
            });
        });
    });
});
