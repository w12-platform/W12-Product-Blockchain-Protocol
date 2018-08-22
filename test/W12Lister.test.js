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
    const wallet = accounts[9];
    const oneToken = new BigNumber(10).pow(18);

    beforeEach(async () => {
        const ledger = await W12TokenLedger.new();
        const swap = await W12AtomicSwap.new(ledger.address);

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

            const receipt = await sut.whitelistToken(accounts[1], token.address, "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.fulfilled;

            (await sut.approvedTokensLength()).should.bignumber.equal(whitelistedTokensCountBefore + 1);

            receipt.logs[0].event.should.be.equal('OwnerWhitelisted');
            receipt.logs[0].args.tokenAddress.should.be.equal(token.address);
            receipt.logs[0].args.tokenOwner.should.be.equal(accounts[1]);
            receipt.logs[0].args.name.should.be.equal("TestTokenForSale");
            receipt.logs[0].args.symbol.should.be.equal("TTFS");
        });

        it('should check that input addresses are not zeros', async () => {
            await sut.whitelistToken(accounts[1], utils.ZERO_ADDRESS, "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.rejected;
            await sut.whitelistToken(utils.ZERO_ADDRESS, token.address, "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.rejected;
            await sut.whitelistToken(utils.ZERO_ADDRESS, utils.ZERO_ADDRESS, "TestTokenForSale", "TTFS", 18 * 100, 50, 50 * 100).should.be.rejected;
        });

        it('should reject add the same token for the same owner multiple times', async () => {
            await sut.whitelistToken(accounts[1], token.address, "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.fulfilled;
            await sut.whitelistToken(accounts[1], token.address, "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.rejected;
        });

        it('should allow to add the same token for different owners', async () => {
            await sut.whitelistToken(accounts[1], token.address, "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.fulfilled;
            await sut.whitelistToken(accounts[2], token.address, "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.fulfilled;
        });

        it('should allow to add different tokens for the same owner', async () => {
            await sut.whitelistToken(accounts[1], utils.generateRandomAddress(), "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.fulfilled;
            await sut.whitelistToken(accounts[1], utils.generateRandomAddress(), "TestTokenForSale", "TTFS", 18, 50 * 100, 50 * 100).should.be.fulfilled;
        });

        describe('when token is listed', async () => {
            let tokenOwner1 = accounts[1];
            let tokenOwner2 = accounts[2];

            const owners = [tokenOwner1, tokenOwner2];

            beforeEach(async () => {
                await sut.whitelistToken(tokenOwner1, token.address, "TestTokenz1", "TT1", 18, 30 * 100, 30 * 100);
                await sut.whitelistToken(tokenOwner2, token.address, "TestTokenz2", "TT2", 18, 40 * 100, 40 * 100);

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
            await sut.whitelistToken(utils.generateRandomAddress(), utils.generateRandomAddress(), "", "", 1, 1 * 100, 1 * 100, {from: accounts[2]}).should.be.rejected;
        });

        describe('when owner set the crowdsale', async () => {
            beforeEach(async () => {
                await sut.whitelistToken(fromTokenOwner.from, token.address, "TestTokenz", "TT", 18, 30 * 100, 30 * 100, fromSystemAccount);

                await token.mint(fromTokenOwner.from, oneToken.mul(10000), 0, fromSystemAccount);
                await token.approve(sut.address, oneToken.mul(10000), fromTokenOwner);

                await sut.placeToken(token.address, oneToken.mul(10), fromTokenOwner).should.be.fulfilled;
            });

            describe('token owner', async () => {
                it('should be able to initialize crowdsale', async () => {
                    await sut.initCrowdsale(
                            lastDate + utils.time.duration.minutes(10),
                            token.address,
                            oneToken.mul(7),
                            oneToken,
                            fromTokenOwner
                        ).should.be.fulfilled;

                    const crowdsaleAddress = await sut.getTokenCrowdsale(token.address, fromTokenOwner.from).should.be.fulfilled;

                    crowdsaleAddress.should.not.be.equal(utils.ZERO_ADDRESS);
                });

                it('shouldn\'t be able to initialize crowdsale with a start date in a past', async () => {
                    await sut.initCrowdsale(
                            lastDate - utils.time.duration.minutes(10),
                            token.address,
                            oneToken.mul(7),
                            oneToken,
                            fromTokenOwner
                        ).should.be.rejectedWith(utils.EVMRevert);
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
                                lastDate + utils.time.duration.minutes(10),
                                token.address,
                                amount,
                                oneToken,
                                fromTokenOwner
                            ).should.be.rejectedWith(utils.EVMRevert);
                        })
                    }
                });
            });

            describe('when crowdsale is set to run', async () => {
                let crowdsale;
                let fundAddress;

                beforeEach(async () => {
                    await sut.initCrowdsale(
                        lastDate + utils.time.duration.minutes(10),
                        token.address,
                        oneToken.mul(6.9),
                        oneToken,
                        fromTokenOwner
                    ).should.be.fulfilled;

                    crowdsale = W12Crowdsale.at(await sut.getTokenCrowdsale(token.address, fromTokenOwner.from));
                    fundAddress = await crowdsale.fund();

                    const discountStages = [
                        {
                            name: 'Phase 0',
                            dates: [
                                lastDate + utils.time.duration.minutes(11),
                                lastDate + utils.time.duration.minutes(60),
                            ],
                            vestingTime: 0,
                            discount: 0,
                            volumeBonuses: [
                                {
                                    boundary: new BigNumber(10000000),
                                    bonus: BigNumber.Zero
                                },
                                {
                                    boundary: new BigNumber(100000000),
                                    bonus: new BigNumber(1)
                                },
                                {
                                    boundary: new BigNumber(1000000000),
                                    bonus: new BigNumber(10)
                                }
                            ]
                        }
                    ];

                    await crowdsale.setStages(
                        discountStages.map(s => s.dates),
                        discountStages.map(s => s.discount),
                        discountStages.map(s => s.vestingTime),
                        fromTokenOwner
                    ).should.be.fulfilled;

                    await crowdsale.setStageVolumeBonuses(0,
                        discountStages[0].volumeBonuses.map(vb => vb.boundary),
                        discountStages[0].volumeBonuses.map(vb => vb.bonus),
                        fromTokenOwner
                    ).should.be.fulfilled;
                });

                it('crowdsale should be activated at time to sell tokens', async () => {
                    await utils.time.increaseTimeTo(lastDate + utils.time.duration.minutes(20));
                    const fundBalanceBefore = web3.eth.getBalance(fundAddress);

                    await crowdsale.buyTokens({ from: accounts[5], value: web3.toWei(1, 'ether') }).should.be.fulfilled;
                    const fundBalanceAfter = web3.eth.getBalance(fundAddress);

                    (fundBalanceAfter.gt(fundBalanceBefore)).should.be.true;
                });

                it('should be able to add tokens to existed crowdsale', async () => {
                    const crowdsaleAddressBefore = await sut.getTokenCrowdsale(token.address, fromTokenOwner.from).should.be.fulfilled;

                    crowdsaleAddressBefore.should.not.be.equal(utils.ZERO_ADDRESS);

                    await sut.addTokensToCrowdsale(
                            token.address,
                            oneToken.mul(0.1),
                            fromTokenOwner
                        ).should.be.fulfilled;

                    const crowdsaleAddressAfter = await sut.getTokenCrowdsale(token.address, fromTokenOwner.from).should.be.fulfilled;

                    crowdsaleAddressBefore.should.be.equal(crowdsaleAddressAfter);
                });

                describe('shouldn\'t be able to re-initialize crowdsale with amount of tokens greater than placed', async () => {
                    const invalidAmounts = [
                        oneToken.mul(0.11),
                        oneToken.mul(1)
                    ];

                    for (const amount of invalidAmounts) {
                        it(`when amount is equal to ${amount.toNumber()}`, async () => {
                            await sut.initCrowdsale(
                                lastDate + utils.time.duration.minutes(10),
                                token.address,
                                amount,
                                oneToken,
                                fromTokenOwner
                            ).should.be.rejectedWith(utils.EVMRevert);
                        })
                    }
                });
            });
        });
    });
});
