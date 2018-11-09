require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const ERC20Mock = artifacts.require('ERC20Mock');
const W12Lister = artifacts.require('W12Lister');
const TokenExchanger = artifacts.require('TokenExchanger');
const W12FundFactory = artifacts.require('W12FundFactory');
const Rates = artifacts.require('Rates');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12CrowdsaleFactoryMock = artifacts.require('W12CrowdsaleFactoryMock');
const WToken = artifacts.require('WToken');
const Wallets = artifacts.require('Wallets');

contract('W12Lister', async (accounts) => {

    describe.skip('old test suit', () => {
        let sut;
        let token;
        let factory;
        let fundFactory;
        let exchanger;
        let rates;
        let wallets;
        const wallet = accounts[9];
        const oneToken = new BigNumber(10).pow(18);

        beforeEach(async () => {
            rates = await Rates.new();
            exchanger = await TokenExchanger.new(0);
            fundFactory = await W12FundFactory.new(0, rates.address);
            wallets = await Wallets.new({from: wallet});
            factory = await W12CrowdsaleFactory.new(0, fundFactory.address, rates.address);
            sut = await W12Lister.new(0, wallets.address, factory.address, exchanger.address);

            await exchanger.transferPrimary(sut.address);

            token = await WToken.new('TestToken', 'TT', 18);
        });

        describe('when called by the owner', async () => {
            const literals = ["TestToken", "ק"];
            const validDecimalsArray = [0, 127, 255];
            const validPercentsArray = [0, 5000, 9999];

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
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                ).should.be.fulfilled;

                (await sut.approvedTokensLength()).should.bignumber.equal(whitelistedTokensCountBefore + 1);

                receipt.logs[0].event.should.be.equal('OwnerWhitelisted');
                receipt.logs[0].args.tokenAddress.should.be.equal(token.address);
                receipt.logs[0].args.tokenOwner.should.be.equal(accounts[1]);
                receipt.logs[0].args.name.should.be.equal("TestTokenForSale");
                receipt.logs[0].args.symbol.should.be.equal("TTFS");
            });

            it('should check that input addresses are not zeros', async () => {
                await sut.whitelistToken(
                    accounts[1],
                    utils.ZERO_ADDRESS,
                    "TestTokenForSale",
                    "TTFS",
                    18,
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5)
                ).should.be.rejected;

                await sut.whitelistToken(
                    utils.ZERO_ADDRESS,
                    token.address,
                    "TestTokenForSale",
                    "TTFS",
                    18,
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5)
                ).should.be.rejected;

                await sut.whitelistToken(
                    utils.ZERO_ADDRESS,
                    utils.ZERO_ADDRESS,
                    "TestTokenForSale",
                    "TTFS",
                    18,
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5),
                    utils.toInternalPercent(5)
                ).should.be.rejected;
            });

            describe('when whitelisting a token with valid properties', async () => {
                // oh my god
                for (const validName of literals)
                    for (const validSymbol of literals)
                        for (const validDecimals of validDecimalsArray)
                            for (const validPercent of validPercentsArray)
                                it(`should whitelist token
                Address: ${accounts[1]}, Name: ${validName}, Symbol: ${validSymbol}, Decimals: ${validDecimals}, Percent: ${validPercent}`, async () => {
                                    const testToken = await WToken.new(validName, validSymbol, validDecimals);

                                    await sut.whitelistToken(accounts[1], testToken.address, validName, validSymbol, validDecimals, validPercent, validPercent, validPercent, validPercent)
                                        .should.be.fulfilled;

                                    await testToken.mint(accounts[1], 1, 0).should.be.fulfilled;
                                    await testToken.approve(sut.address, 1, {from: accounts[1]}).should.be.fulfilled;
                                    await sut.placeToken(testToken.address, 1, {from: accounts[1]}).should.be.fulfilled;

                                    const actualWTokenAddress = await exchanger.getWTokenByToken(testToken.address).should.be.fulfilled;

                                    actualWTokenAddress.should.not.be.equal(utils.ZERO_ADDRESS);

                                    const actualWToken = WToken.at(actualWTokenAddress);

                                    (await actualWToken.decimals().should.be.fulfilled).should.bignumber.equal(validDecimals);
                                    (await actualWToken.symbol().should.be.fulfilled).should.be.equal(validSymbol);
                                    (await actualWToken.name().should.be.fulfilled).should.be.equal(validName);
                                });
            });

            describe('when token is listed', async () => {
                let tokenOwner1 = accounts[1];
                let tokenOwner2 = accounts[2];

                const owners = [tokenOwner1, tokenOwner2];

                beforeEach(async () => {
                    await sut.whitelistToken(
                        tokenOwner1,
                        token.address,
                        "TestTokenz1",
                        "TT1",
                        18,
                        utils.toInternalPercent(30),
                        utils.toInternalPercent(30),
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5)
                    );

                    await sut.whitelistToken(
                        tokenOwner2,
                        token.address,
                        "TestTokenz2",
                        "TT2",
                        18,
                        utils.toInternalPercent(40),
                        utils.toInternalPercent(40),
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5)
                    );

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

                    const last = placementReceipt.logs.length - 1;

                    placementReceipt.logs[last].event.should.be.equal('TokenPlaced');
                    placementReceipt.logs[last].args.originalTokenAddress.should.be.equal(token.address);
                    placementReceipt.logs[last].args.tokenOwner.should.be.equal(tokenOwner1);
                    placementReceipt.logs[last].args.tokenAmount.should.bignumber.equal(oneToken.mul(7));
                    placementReceipt.logs[last].args.placedTokenAddress.should.not.be.equal(utils.ZERO_ADDRESS);

                    const exchangerAddress = await sut.getExchanger();
                    const serviceWalletAddress = await sut.serviceWallet();
                    const actualExchangerBalance = await token.balanceOf(exchangerAddress);
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

                    const last = placementReceipt.logs.length - 1;

                    placementReceipt.logs[last].event.should.be.equal('TokenPlaced');
                    placementReceipt.logs[last].args.originalTokenAddress.should.be.equal(token.address);
                    placementReceipt.logs[last].args.tokenOwner.should.be.equal(tokenOwner2);
                    placementReceipt.logs[last].args.tokenAmount.should.bignumber.equal(oneToken.mul(6));
                    placementReceipt.logs[last].args.placedTokenAddress.should.not.be.equal(utils.ZERO_ADDRESS);

                    const exchangerAddress = await sut.getExchanger();
                    const serviceWalletAddress = await sut.serviceWallet();
                    const actualExchangerBalance = await token.balanceOf(exchangerAddress);
                    const actualServiceWalletBalance = await token.balanceOf(serviceWalletAddress);

                    actualExchangerBalance.should.bignumber.equal(oneToken.mul(6));
                    actualServiceWalletBalance.should.bignumber.equal(oneToken.mul(4));
                });
            });
        });

        describe('when called not by the owner', async () => {
            const fromSystemAccount = {from: accounts[0]};
            const fromTokenOwner = {from: accounts[1]};

            it('should reject whitelisting a token', async () => {
                await sut.whitelistToken(
                    utils.generateRandomAddress(), utils.generateRandomAddress()
                    , "", "", 1
                    , utils.toInternalPercent(1), utils.toInternalPercent(1)
                    , utils.toInternalPercent(1), utils.toInternalPercent(1)
                    , {from: accounts[2]}).should.be.rejected;
            });

            describe('running crowdsale', async () => {
                const placedAmount = oneToken.mul(10);
                const buyCommissionInTokens = new BigNumber(utils.toInternalPercent(5));
                const placeCommissionInTokens = new BigNumber(utils.toInternalPercent(30));

                beforeEach(async () => {
                    await sut.whitelistToken(
                        fromTokenOwner.from, token.address
                        , "TestTokenz", "TT", 18
                        , placeCommissionInTokens, utils.toInternalPercent(30)
                        , buyCommissionInTokens, utils.toInternalPercent(10)
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

                        const expectedCrowdsaleSwapAllowance = utils.percent(saleAmount, buyCommissionInTokens);

                        (await token.allowance(exchanger.address, crowdsaleAddress))
                            .should.bignumber.eq(expectedCrowdsaleSwapAllowance);
                    });

                    it('should emmit `CrowdsaleTokenMinted`', async () => {
                        const event = await utils.expectEvent.inLogs(logs, 'CrowdsaleTokenMinted');

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

        describe('roles', async () => {
            const owner = accounts[0];
            const admin = accounts[1];

            describe('should successful', () => {

                it('add admin', async () => {
                    await sut.addAdmin(admin);

                    (await sut.isAdmin(admin)).should.to.be.true;
                });

                it('remove admin', async () => {
                    await sut.addAdmin(admin);
                    await sut.removeAdmin(admin);

                    (await sut.isAdmin(admin)).should.to.be.false;
                });

                it('whitelist token when call from a admin', async () => {
                    await sut.addAdmin(admin);
                    await sut.whitelistToken(
                        accounts[1],
                        utils.generateRandomAddress(),
                        "TestTokenForSale",
                        "TTFS",
                        18,
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5),
                        {from: admin}
                    ).should.be.fulfilled;
                });
            });

            describe('should revert', () => {

                it('when whitelisting token from not a admin', async () => {
                    await sut.whitelistToken(
                        accounts[1],
                        utils.generateRandomAddress(),
                        "TestTokenForSale",
                        "TTFS",
                        18,
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5),
                        utils.toInternalPercent(5),
                        {from: admin}
                    ).should.be.rejectedWith(utils.EVMRevert);
                });
            });
        });
    });

    // [x] Whitelist input validation
    // [x] When whitelist new owners should not be added to active crowdsales
    // [x] When whitelist new owners should be added to not active crowdsales
    // [x] ]When whitelist owners list length must be greater then 0 if added token previous was not added
    // [x] When whitelist owners list should not contain zero addresses
    // [x] Whitelist should revert for not admin account
    // [x] Check all input provided to crowdsale creation
    // [] When whitelist should create new records not overwrite parameters of any of existing records with the same token address

    const ctx = {};
    const createLister = async (wallet) => {
        const result = {};

        result.Rates = await Rates.new();
        result.Exchanger = await TokenExchanger.new(0);
        result.FundFactory = await W12FundFactory.new(0, result.Rates.address);
        result.Wallets = await Wallets.new({from: wallet});
        result.CrowdsaleFactory = await W12CrowdsaleFactoryMock.new();
        await result.CrowdsaleFactory._createCrowdsaleReturn(result.CrowdsaleFactory.address);
        result.Lister = await W12Lister.new(0, result.Wallets.address, result.CrowdsaleFactory.address, result.Exchanger.address);

        await result.Exchanger.transferPrimary(result.Lister.address);

        return result;
    };

    describe('whitelisting tokens', () => {

        describe('input validation', () => {
            const ctx = {};

            beforeEach(async () => {
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
            });

            it('should revert if owners list length is zero when no listed token for given address', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        ctx.Token1.address, '1', '1', 18, [], 0, 0, 0, 0
                    ));
            });

            it('should revert if owners list contain zero addresses', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        ctx.Token1.address, '1', '1', 18, [utils.ZERO_ADDRESS, utils.generateRandomAddress()], 0, 0, 0, 0
                    ));
            });

            it('should revert token address is zero', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        utils.ZERO_ADDRESS, '1', '1', 18, [utils.generateRandomAddress()], 0, 0, 0, 0
                    ));
            });

            it('should revert one or more addresses in owners list already has been bound to token', async () => {
                const anOwner = utils.generateRandomAddress();
                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, [anOwner], 0, 0, 0, 0
                );
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        utils.ZERO_ADDRESS, '1', '1', 18, [anOwner], 0, 0, 0, 0
                    ));
            });
        });

        describe('restrictions', () => {
            const ctx = {};

            before(async () => {
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
            });

            it('should revert if sender address is not an admin', async () => {
                const notAnAdmin = accounts[1];
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        ctx.Token1.address, '1', '1', 18, [utils.generateRandomAddress()], 0, 0, 0, 0,
                        { from: notAnAdmin }
                    ));
            });
        });

        describe('owners list', () => {
            before(async () => {
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
                ctx.Token2 = await ERC20Mock.new('2', '2', 18);
            });

            it('should add owners to list for token1', async () => {
                ctx.owners = [utils.generateRandomAddress(), utils.generateRandomAddress()];

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners, 0, 0, 0, 0
                );

                const actualOwners = await ctx.Lister.getTokenOwners(ctx.Token1.address);

                actualOwners.should.to.deep.equal(ctx.owners);
            });

            it('should add owners to list for token1', async () => {
                const owners = [utils.generateRandomAddress(), utils.generateRandomAddress()];

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, owners, 0, 0, 0, 0
                );

                ctx.owners.push(...owners);

                const actualOwners = await ctx.Lister.getTokenOwners(ctx.Token1.address);

                actualOwners.should.to.deep.equal(ctx.owners);
            });

            it('should add owners to list for token2', async () => {
                ctx.anotherOwners = [utils.generateRandomAddress(), utils.generateRandomAddress()];

                await ctx.Lister.whitelistToken(
                    ctx.Token2.address, '2', '2', 18, ctx.anotherOwners, 0, 0, 0, 0
                );

                const actualOwners = await ctx.Lister.getTokenOwners(ctx.Token2.address);

                actualOwners.should.to.deep.equal(ctx.anotherOwners);
            });

            it('should not add token2 owners to token1 owners', async () => {
                const actualOwners = await ctx.Lister.getTokenOwners(ctx.Token1.address);

                actualOwners.should.to.deep.equal(ctx.owners);
            });

            it('should not add owners to field of whitelisted token record', async () => {
                const actualOwners = (await ctx.Lister.getListedToken(0))[3];

                actualOwners.length.should.to.equal(0);
            });
        });
    });

    describe('placing tokens', () => {});

    describe('initialize crowdsale', () => {

        describe('input validation', () => {
            const ctx = {};

            beforeEach(async () => {
                const oneToken = ctx.oneToken = BigNumber.TEN.pow(18);

                ctx.owners = [accounts[1], accounts[2], accounts[3], accounts[4]];
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);

                await ctx.Token1.mint(accounts[1], oneToken.mul(100));
                await ctx.Token1.mint(accounts[2], oneToken.mul(100));
                await ctx.Token1.mint(accounts[3], oneToken.mul(100));
                await ctx.Token1.mint(accounts[4], oneToken.mul(100));
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), { from: accounts[1] });
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), { from: accounts[2] });
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), { from: accounts[3] });
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), { from: accounts[4] });

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, [ctx.owners[0], ctx.owners[1]], 0, 0, 0, 0
                );
                await ctx.Lister.placeToken(0, oneToken.mul(50), { from: ctx.owners[0] });
                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, [ctx.owners[2], ctx.owners[3]], 0, 0, 0, 0
                );
                await ctx.Lister.placeToken(1, oneToken.mul(50), {from: ctx.owners[2]});
            });

            it('should revert if token index does not exists', async () => {
                const owner = ctx.owners[0];
                await utils.shouldFail.reverting(
                    ctx.Lister.initCrowdsale(2, ctx.oneToken.mul(10), utils.toInternalUSD(1), { from: owner })
                );
            });

            it('should revert sender is not an owner', async () => {
                const notAnOwner = accounts[5];
                await utils.shouldFail.reverting(
                    ctx.Lister.initCrowdsale(0, ctx.oneToken.mul(10), utils.toInternalUSD(1), { from: notAnOwner })
                );
            });

            it('should revert if crowdsale already has been initialized', async () => {
                const owner = ctx.owners[0];
                await ctx.Lister.initCrowdsale(0, ctx.oneToken.mul(10), utils.toInternalUSD(1), {from: owner});
                await utils.shouldFail.reverting(
                    ctx.Lister.initCrowdsale(0, ctx.oneToken.mul(10), utils.toInternalUSD(1), {from: owner})
                );
            });
        });

        describe('owners list', () => {
            const ctx = {};

            before(async () => {
                const oneToken = ctx.oneToken = BigNumber.TEN.pow(18);

                ctx.owners1 = [accounts[1], accounts[2]];
                ctx.owners2 = [accounts[3], accounts[4]];
                const result = await createLister(accounts[0]);
                ctx.Lister = result.Lister;
                ctx.CrowdsaleFactory = result.CrowdsaleFactory;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
                ctx.Token2 = await ERC20Mock.new('2', '2', 18);

                await ctx.Token1.mint(accounts[1], oneToken.mul(100));
                await ctx.Token1.mint(accounts[2], oneToken.mul(100));
                await ctx.Token1.mint(accounts[3], oneToken.mul(100));
                await ctx.Token1.mint(accounts[4], oneToken.mul(100));
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), {from: accounts[1]});
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), {from: accounts[2]});
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), {from: accounts[3]});
                await ctx.Token1.approve(ctx.Lister.address, oneToken.mul(100), {from: accounts[4]});

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners1, 0, 0, 0, 0
                );
                await ctx.Lister.placeToken(0, oneToken.mul(10), {from: ctx.owners1[0]});
            });

            it('should call crowdsale factory with owners', async () => {
                const owner = ctx.owners1[0];
                await ctx.CrowdsaleFactory._createCrowdsaleReturn(utils.generateRandomAddress());
                await ctx.Lister.initCrowdsale(0, ctx.oneToken.mul(5), utils.toInternalUSD(1), { from: owner });
                const callResult = await ctx.CrowdsaleFactory._createCrowdsaleCall();

                callResult[8].should.to.deep.equal(ctx.owners1);
            });

            it('should add owners to field of token whitelisted record', async () => {
                const actualOwners = (await ctx.Lister.getListedToken(0))[3];

                actualOwners.should.to.deep.equal(ctx.owners1);
            });

            it('should call crowdsale factory with new owners', async () => {
                const owner = ctx.owners2[0];

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners2, 0, 0, 0, 0
                );
                await ctx.Lister.placeToken(1, ctx.oneToken.mul(10), {from: owner});
                await ctx.CrowdsaleFactory._createCrowdsaleReturn(utils.generateRandomAddress());
                await ctx.Lister.initCrowdsale(1, ctx.oneToken.mul(5), utils.toInternalUSD(1), {from: owner});

                const callResult = await ctx.CrowdsaleFactory._createCrowdsaleCall();

                callResult[8].should.to.deep.equal(ctx.owners1.concat(ctx.owners2));
            });

            it('should keep owners added while crowdsale initialization', async () => {
                const actualOwners = (await ctx.Lister.getListedToken(0))[3];

                actualOwners.should.to.deep.equal(ctx.owners1);
            });
        });
    });
});
