require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const ERC20Mock = artifacts.require('ERC20Mock');
const W12Lister = artifacts.require('W12Lister');
const TokenExchanger = artifacts.require('TokenExchanger');
const W12FundFactory = artifacts.require('W12FundFactory');
const Rates = artifacts.require('Rates');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Lister__W12CrowdsaleFactoryMock = artifacts.require('W12Lister__W12CrowdsaleFactoryMock');
const W12Lister__W12CrowdsaleMock = artifacts.require('W12Lister__W12CrowdsaleMock');
const W12Lister__W12FundMock = artifacts.require('W12Lister__W12FundMock');
const WToken = artifacts.require('WToken');
const Wallets = artifacts.require('Wallets');

contract('W12Lister', async (accounts) => {

    describe('old test suit', () => {
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

            describe('when whitelisting a token with valid properties', async () => {
                for (const validName of literals)
                    for (const validSymbol of literals)
                        for (const validDecimals of validDecimalsArray)
                            for (const validPercent of validPercentsArray)
                                it(`should whitelist token
                Address: ${accounts[1]}, Name: ${validName}, Symbol: ${validSymbol}, Decimals: ${validDecimals}, Percent: ${validPercent}`, async () => {
                                    const testToken = await WToken.new(validName, validSymbol, validDecimals);

                                    await sut.whitelistToken(
                                        testToken.address, validName, validSymbol, validDecimals, [accounts[1]],
                                        [validPercent, validPercent, validPercent, validPercent],
                                        [], []
                                    )
                                        .should.be.fulfilled;

                                    await testToken.mint(accounts[1], 1, 0).should.be.fulfilled;
                                    await testToken.approve(sut.address, 1, {from: accounts[1]}).should.be.fulfilled;
                                    await sut.placeToken(testToken.address, 0, 1, {from: accounts[1]}).should.be.fulfilled;

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
                        token.address,
                        "TestTokenz1",
                        "TT1",
                        18,
                        [tokenOwner1],
                        [
                            utils.toInternalPercent(30),
                            utils.toInternalPercent(30),
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5)
                        ],
                        [], []
                    );

                    await token.mint(tokenOwner1, oneToken.mul(10000), 0);
                    await token.approve(sut.address, oneToken.mul(10000), {from: tokenOwner1});

                    await token.mint(tokenOwner2, oneToken.mul(10000), 0);
                    await token.approve(sut.address, oneToken.mul(10000), {from: tokenOwner2});
                });

                it('should place token to exchange for owner 1', async () => {
                    const placementReceipt = await sut.placeToken(
                        token.address,
                        0,
                        oneToken.mul(10),
                        {from: tokenOwner1}
                    ).should.be.fulfilled;

                    const last = placementReceipt.logs.length - 1;

                    placementReceipt.logs[last].event.should.be.equal('TokenPlaced');
                    placementReceipt.logs[last].args.originalToken.should.be.equal(token.address);
                    placementReceipt.logs[last].args.sender.should.be.equal(tokenOwner1);
                    placementReceipt.logs[last].args.tokenAmount.should.bignumber.equal(oneToken.mul(7));
                    placementReceipt.logs[last].args.placedToken.should.not.be.equal(utils.ZERO_ADDRESS);

                    const exchangerAddress = await sut.getExchanger();
                    const serviceWalletAddress = await sut.serviceWallet();
                    const actualExchangerBalance = await token.balanceOf(exchangerAddress);
                    const actualServiceWalletBalance = await token.balanceOf(serviceWalletAddress);

                    actualExchangerBalance.should.bignumber.equal(oneToken.mul(7));
                    actualServiceWalletBalance.should.bignumber.equal(oneToken.mul(3));
                });

                it('should place token to exchange for owner 2', async () => {
                    await sut.whitelistToken(
                        token.address,
                        "TestTokenz2",
                        "TT2",
                        18,
                        [tokenOwner2],
                        [
                            utils.toInternalPercent(40),
                            utils.toInternalPercent(40),
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5)
                        ],
                        [], []
                    );

                    const placementReceipt = await sut.placeToken(
                        token.address,
                        0,
                        oneToken.mul(10),
                        {from: tokenOwner2}
                    ).should.be.fulfilled;

                    const last = placementReceipt.logs.length - 1;

                    placementReceipt.logs[last].event.should.be.equal('TokenPlaced');
                    placementReceipt.logs[last].args.originalToken.should.be.equal(token.address);
                    placementReceipt.logs[last].args.sender.should.be.equal(tokenOwner2);
                    placementReceipt.logs[last].args.tokenAmount.should.bignumber.equal(oneToken.mul(6));
                    placementReceipt.logs[last].args.placedToken.should.not.be.equal(utils.ZERO_ADDRESS);

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
                    utils.generateRandomAddress()
                    , "", "", 1
                    , [utils.generateRandomAddress()]
                    , [
                        utils.toInternalPercent(1), utils.toInternalPercent(1)
                        , utils.toInternalPercent(1), utils.toInternalPercent(1)
                    ], [], []
                    , {from: accounts[2]}).should.be.rejected;
            });

            describe('running crowdsale', async () => {
                const placedAmount = oneToken.mul(10);
                const buyCommissionInTokens = new BigNumber(utils.toInternalPercent(5));
                const placeCommissionInTokens = new BigNumber(utils.toInternalPercent(30));

                beforeEach(async () => {
                    await sut.whitelistToken(
                        token.address
                        , "TestTokenz", "TT", 18
                        , [fromTokenOwner.from]
                        , [
                            placeCommissionInTokens, utils.toInternalPercent(30)
                            , buyCommissionInTokens, utils.toInternalPercent(10)
                        ], [], []
                        , fromSystemAccount);

                    await token.mint(fromTokenOwner.from, oneToken.mul(10000), 0, fromSystemAccount);
                    await token.approve(sut.address, oneToken.mul(10000), fromTokenOwner);

                    await sut.placeToken(token.address, 0, placedAmount, fromTokenOwner).should.be.fulfilled;
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

                    it('should be approved to spend token from swap address for commission', async () => {
                        const [crowdsaleAddress] = await sut.getCrowdsales(token.address);

                        (await token.allowance(exchanger.address, crowdsaleAddress))
                            .should.bignumber.eq(saleAmount);
                    });

                    it('should emmit `CrowdsaleTokenMinted`', async () => {
                        const [crowdsaleAddress] = await sut.getCrowdsales(token.address);
                        const event = await utils.expectEvent.inLogs(logs, 'CrowdsaleTokenMinted');

                        event.args.token.should.eq(token.address);
                        event.args.sender.should.eq(fromTokenOwner.from);
                        event.args.crowdsale.should.eq(crowdsaleAddress);
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

                        crowdsaleAddress = (await sut.getCrowdsales(token.address))[0];
                    });

                    it('should be able to add tokens to existed crowdsale', async () => {
                        const crowdsaleAddressBefore = crowdsaleAddress;

                        await sut.addTokensToCrowdsale(
                            token.address,
                            crowdsaleAddress,
                            oneToken.mul(0.1),
                            fromTokenOwner
                        ).should.be.fulfilled;

                        const crowdsaleAddressAfter = (await sut.getCrowdsales(token.address))[0];

                        crowdsaleAddressBefore.should.be.equal(crowdsaleAddressAfter);
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
                        utils.generateRandomAddress(),
                        "TestTokenForSale",
                        "TTFS",
                        18,
                        [accounts[1]],
                        [
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5),
                        ], [], [],
                        {from: admin}
                    ).should.be.fulfilled;
                });
            });

            describe('should revert', () => {

                it('when whitelisting token from not a admin', async () => {
                    await sut.whitelistToken(
                        utils.generateRandomAddress(),
                        "TestTokenForSale",
                        "TTFS",
                        18,
                        [accounts[1]],
                        [
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5),
                            utils.toInternalPercent(5),
                        ], [], [],
                        {from: admin}
                    ).should.be.rejectedWith(utils.EVMRevert);
                });
            });
        });
    });

    const ctx = {};
    const createLister = async (wallet) => {
        const result = {};

        result.Rates = await Rates.new();
        result.Exchanger = await TokenExchanger.new(0);
        result.FundFactory = await W12FundFactory.new(0, result.Rates.address);
        result.Wallets = await Wallets.new({from: wallet});
        result.CrowdsaleFactory = await W12Lister__W12CrowdsaleFactoryMock.new();
        result.Lister = await W12Lister.new(0, result.Wallets.address, result.CrowdsaleFactory.address, result.Exchanger.address);

        await result.Exchanger.transferPrimary(result.Lister.address);

        return result;
    };
    const getUpdatePurchaseFeeParameterCalls = async (crowdsale) => {
        const result = [];
        const length = (await crowdsale._updatePurchaseFeeParameterForPaymentMethodCallsLength()).toNumber();
        for(let i = 0; i < length; i++) {
            const [symbol, has, value] = await crowdsale._updatePurchaseFeeParameterForPaymentMethodCall(i);
            result.push({
                symbol: web3.toUtf8(symbol),
                has,
                value
            });
        }
        return result;
    };
    const paymentMethodA = web3.fromUtf8('A');
    const paymentMethodB = web3.fromUtf8('B');
    const paymentMethodC = web3.fromUtf8('C');
    const purchaseFeeA = utils.toInternalPercent(10);
    const purchaseFeeZero = utils.toInternalPercent(0);
    const purchaseFeeMax = utils.toInternalPercent(99.99);
    const purchaseFeeGreaterThenMax = utils.toInternalPercent(100);

    describe('whitelisting tokens', () => {

        describe('input validation', () => {
            const ctx = {};

            beforeEach(async () => {
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
            });

            it('should revert if owners list is empty', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        ctx.Token1.address, '1', '1', 18, [], [0, 0, 0, 0], [], []
                    ));
            });

            it('should revert if owners list contains zero addresses', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        ctx.Token1.address, '1', '1', 18, [utils.ZERO_ADDRESS, utils.generateRandomAddress()], [0, 0, 0, 0], [], []
                    ));
            });

            it('should revert for zero token address', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        utils.ZERO_ADDRESS, '1', '1', 18, [utils.generateRandomAddress()], [0, 0, 0, 0], [], []
                    ));
            });

            it('should revert if payment methods list length is not equal payment methods purchase fee list', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        utils.ZERO_ADDRESS, '1', '1', 18, [utils.generateRandomAddress()], [0, 0, 0, 0], [paymentMethodA], []
                    ));
            });

            it('should revert if purchase fee greater then 99.99%', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        utils.ZERO_ADDRESS, '1', '1', 18, [utils.generateRandomAddress()], [0, 0, 0, 0], [paymentMethodA], [purchaseFeeGreaterThenMax]
                    ));
            });

            it('should revert payment methods list with duplicates', async () => {
                await utils.shouldFail.reverting(
                    ctx.Lister.whitelistToken(
                        utils.ZERO_ADDRESS, '1', '1', 18, [utils.generateRandomAddress()], [0, 0, 0, 0],
                        [paymentMethodA, paymentMethodA], [purchaseFeeA, purchaseFeeA]
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
                        ctx.Token1.address, '1', '1', 18, [utils.generateRandomAddress()], [0, 0, 0, 0], [], [],
                        { from: notAnAdmin }
                    ));
            });
        });

        // should add new token to list
        describe('adding token', () => {
            const ctx = {};

            before(async () => {
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
                ctx.Token2 = await ERC20Mock.new('2', '2', 18);
                ctx.owners1 = [utils.generateRandomAddress(), utils.generateRandomAddress()];
                ctx.owners2 = [utils.generateRandomAddress(), utils.generateRandomAddress()];
                ctx.owners3 = [utils.generateRandomAddress(), utils.generateRandomAddress()];

                ctx.Tx = await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners1, [0, 0, 0, 0], [paymentMethodA], [purchaseFeeA]
                );
            });

            it('should add token to list', async () => {
                const actualList = await ctx.Lister.getTokens();
                actualList.should.to.deep.equal([ctx.Token1.address]);
            });

            it('should confirm whitelisting of token', async () => {
                const actualResult = await ctx.Lister.isTokenWhitelisted(ctx.Token1.address);
                actualResult.should.to.be.true;
            });

            it('should confirm whitelisting of owners', async () => {
                for(const owner of ctx.owners1) {
                    const actualResult = await ctx.Lister.hasTokenOwner(ctx.Token1.address, owner);
                    actualResult.should.to.be.true;
                }
            });

            it('should put a not initialized crowdsale to list', async () => {
                const actualList = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                actualList.should.to.deep.equal([utils.ZERO_ADDRESS]);
            });

            it('should confirm creation of not initialized crowdsale', async () => {
                const actualList = await ctx.Lister.hasNotInitialisedCrowdsale(ctx.Token1.address);
                actualList.should.to.be.true;
            });

            it('should confirm existence of crowdsale with zero address', async () => {
                const actualList = await ctx.Lister.hasCrowdsaleWithAddress(ctx.Token1.address, utils.ZERO_ADDRESS);
                actualList.should.to.be.true;
            });

            it('should correctly fill all parameters of whitelisted token', async () => {
                const actualRecord = await ctx.Lister.getToken(ctx.Token1.address);

                actualRecord[0].should.to.equal(await ctx.Token1.name());
                actualRecord[1].should.to.equal(await ctx.Token1.symbol());
                actualRecord[2].should.bignumber.eq(await ctx.Token1.decimals());
                actualRecord[3].should.to.deep.equal(ctx.owners1);
                actualRecord[4].map(i => i.toNumber()).should.to.deep.equal([0, 0, 0, 0]);
                actualRecord[5].map(i => web3.toUtf8(i)).should.to.deep.equal([web3.toUtf8(paymentMethodA)]);
                actualRecord[6].map(i => i.toNumber()).should.to.deep.equal([purchaseFeeA]);
            });

            it('should correctly fill all parameters of not initialized crowdsale', async () => {
                const actualRecord = await ctx.Lister.getCrowdsale(ctx.Token1.address, utils.ZERO_ADDRESS);

                actualRecord[0].map(i => i.toNumber()).should.to.deep.equal([0, 0, 0, 0]);
                actualRecord[1].map(i => i.toNumber()).should.to.deep.equal([0, 0]);
                actualRecord[2].should.to.deep.equal([]);
                actualRecord[3].should.to.deep.equal([]);
                actualRecord[4].should.to.deep.equal([]);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inLogs(ctx.Tx.logs, 'TokenWhitelisted', {
                    token: ctx.Token1.address,
                    sender: accounts[0],
                    owners: ctx.owners1
                });
            });

            it('should emit event for each whitelisted owner', async () => {
                const logs = ctx.Tx.logs.filter(record => record.event === 'OwnerWhitelisted');

                logs.length.should.to.equal(2);
                logs[0].args.tokenAddress.should.to.equal(ctx.Token1.address);
                logs[1].args.tokenAddress.should.to.equal(ctx.Token1.address);
                logs[0].args.tokenOwner.should.to.equal(ctx.owners1[0]);
                logs[1].args.tokenOwner.should.to.equal(ctx.owners1[1]);
            });
        });

        describe('adding another token', () => {
            const ctx = {};

            before(async () => {
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
                ctx.Token2 = await ERC20Mock.new('2', '2', 18);
                ctx.owners1 = [utils.generateRandomAddress(), utils.generateRandomAddress()];
                ctx.owners2 = [utils.generateRandomAddress(), utils.generateRandomAddress()];
                ctx.owners3 = [utils.generateRandomAddress(), utils.generateRandomAddress()];

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners1, [0, 0, 0, 0], [], []
                );

                ctx.Tx = await ctx.Lister.whitelistToken(
                    ctx.Token2.address, '2', '2', 18, ctx.owners2, [0, 0, 0, 0], [paymentMethodA], [purchaseFeeA]
                );
            });

            it('should add token to list', async () => {
                const actualList = await ctx.Lister.getTokens();
                actualList.should.to.deep.equal([ctx.Token1.address, ctx.Token2.address]);
            });

            it('should confirm whitelisting a token', async () => {
                const actualResult = await ctx.Lister.isTokenWhitelisted(ctx.Token2.address);
                actualResult.should.to.be.true;
            });

            it('should confirm whitelisting owners', async () => {
                for (const owner of ctx.owners2) {
                    const actualResult = await ctx.Lister.hasTokenOwner(ctx.Token2.address, owner);
                    actualResult.should.to.be.true;
                }
            });

            it('should put a not initialized crowdsale to list', async () => {
                const actualList = await ctx.Lister.getCrowdsales(ctx.Token2.address);
                actualList.should.to.deep.equal([utils.ZERO_ADDRESS]);
            });

            it('should confirm creation of not initialized crowdsale', async () => {
                const actualList = await ctx.Lister.hasNotInitialisedCrowdsale(ctx.Token2.address);
                actualList.should.to.be.true;
            });

            it('should confirm existence of crowdsale with zero address', async () => {
                const actualList = await ctx.Lister.hasCrowdsaleWithAddress(ctx.Token2.address, utils.ZERO_ADDRESS);
                actualList.should.to.be.true;
            });

            it('should correctly fill all parameters of whitelisted token', async () => {
                const actualRecord = await ctx.Lister.getToken(ctx.Token2.address);

                actualRecord[0].should.to.equal(await ctx.Token2.name());
                actualRecord[1].should.to.equal(await ctx.Token2.symbol());
                actualRecord[2].should.bignumber.eq(await ctx.Token2.decimals());
                actualRecord[3].should.to.deep.equal(ctx.owners2);
                actualRecord[4].map(i => i.toNumber()).should.to.deep.equal([0, 0, 0, 0]);
                actualRecord[5].map(i => web3.toUtf8(i)).should.to.deep.equal([web3.toUtf8(paymentMethodA)]);
                actualRecord[6].map(i => i.toNumber()).should.to.deep.equal([purchaseFeeA]);
            });

            it('should correctly fill all parameters of not initialized crowdsale', async () => {
                const actualRecord = await ctx.Lister.getCrowdsale(ctx.Token2.address, utils.ZERO_ADDRESS);

                actualRecord[0].map(i => i.toNumber()).should.to.deep.equal([0, 0, 0, 0]);
                actualRecord[1].map(i => i.toNumber()).should.to.deep.equal([0, 0]);
                actualRecord[2].should.to.deep.equal([]);
                actualRecord[3].should.to.deep.equal([]);
                actualRecord[4].should.to.deep.equal([]);
            });
        });

        describe('updating token', () => {
            const ctx = {};

            before(async () => {
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);
                ctx.Token2 = await ERC20Mock.new('2', '2', 18);
                ctx.owners1 = [utils.generateRandomAddress(), utils.generateRandomAddress()];
                ctx.owners2 = [utils.generateRandomAddress(), utils.generateRandomAddress()];
                ctx.owners3 = [utils.generateRandomAddress(), utils.generateRandomAddress()];

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners1, [0, 0, 0, 0], [], []
                );

                ctx.Tx = await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '2', '2', 18, ctx.owners2, [100, 100, 100, 100],
                    [paymentMethodA], [purchaseFeeA]
                );
            });

            it('should`t add duplicate to list', async () => {
                const actualList = await ctx.Lister.getTokens();
                actualList.should.to.deep.equal([ctx.Token1.address]);
            });

            it('should`t confirm whitelisting of previous owners', async () => {
                for (const owner of ctx.owners1) {
                    const actualResult = await ctx.Lister.hasTokenOwner(ctx.Token1.address, owner);
                    actualResult.should.to.be.false;
                }
            });

            it('should confirm whitelisting of owners', async () => {
                for (const owner of ctx.owners2) {
                    const actualResult = await ctx.Lister.hasTokenOwner(ctx.Token1.address, owner);
                    actualResult.should.to.be.true;
                }
            });

            it('should`t put a not initialized crowdsale to list', async () => {
                const actualList = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                actualList.should.to.deep.equal([utils.ZERO_ADDRESS]);
            });

            it('should update all parameters of whitelisted token', async () => {
                const actualRecord = await ctx.Lister.getToken(ctx.Token1.address);

                actualRecord[0].should.to.equal('2');
                actualRecord[1].should.to.equal('2');
                actualRecord[2].should.bignumber.eq(await ctx.Token1.decimals());
                actualRecord[3].should.to.deep.equal(ctx.owners2);
                actualRecord[4].map(i => i.toNumber()).should.to.deep.equal([100, 100, 100, 100]);
                actualRecord[5].map(i => web3.toUtf8(i)).should.to.deep.equal([web3.toUtf8(paymentMethodA)]);
                actualRecord[6].map(i => i.toNumber()).should.to.deep.equal([purchaseFeeA]);
            });

            it('should`t update parameters of not initialized crowdsale', async () => {
                const actualRecord = await ctx.Lister.getCrowdsale(ctx.Token1.address, utils.ZERO_ADDRESS);

                actualRecord[0].map(i => i.toNumber()).should.to.deep.equal([0, 0, 0, 0]);
                actualRecord[1].map(i => i.toNumber()).should.to.deep.equal([0, 0]);
                actualRecord[2].should.to.deep.equal([]);
                actualRecord[3].should.to.deep.equal([]);
                actualRecord[4].should.to.deep.equal([]);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inLogs(ctx.Tx.logs, 'TokenWhitelisted', {
                    token: ctx.Token1.address,
                    sender: accounts[0],
                    owners: ctx.owners2
                });
            });

            it('should emit event for each whitelisted owner', async () => {
                const logs = ctx.Tx.logs.filter(record => record.event === 'OwnerWhitelisted');

                logs.length.should.to.equal(2);
                logs[0].args.tokenAddress.should.to.equal(ctx.Token1.address);
                logs[1].args.tokenAddress.should.to.equal(ctx.Token1.address);
                logs[0].args.tokenOwner.should.to.equal(ctx.owners2[0]);
                logs[1].args.tokenOwner.should.to.equal(ctx.owners2[1]);
            });
        });
    });

    describe.skip('placing tokens', () => {});

    describe('crowdsale initialization', () => {
        const mintAndApprove = async (token, accounts, spender, amount) => {
            for (const account of accounts) {
                await token.mint(account, amount);
                await token.approve(spender, amount, {from: account});
            }
        };

        describe('input validation', () => {
            const ctx = {};

            beforeEach(async () => {
                const oneToken = ctx.oneToken = BigNumber.TEN.pow(18);

                ctx.owners = [accounts[1], accounts[2]];
                ctx.Lister = (await createLister(accounts[0])).Lister;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);

                await mintAndApprove(ctx.Token1, ctx.owners, ctx.Lister.address, oneToken.mul(100));

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners, [0, 0, 0, 0], [], []
                );
                await ctx.Lister.placeToken(ctx.Token1.address, 0, oneToken.mul(50), { from: ctx.owners[0] });
            });

            it('should revert for nonexistent token', async () => {
                const owner = ctx.owners[0];
                await utils.shouldFail.reverting(
                    ctx.Lister.initCrowdsale(utils.generateRandomAddress(), ctx.oneToken.mul(10), utils.toInternalUSD(1), { from: owner })
                );
            });

            it('should revert if sender is not an owner', async () => {
                const notAnOwner = accounts[5];
                await utils.shouldFail.reverting(
                    ctx.Lister.initCrowdsale(ctx.Token1.address, ctx.oneToken.mul(10), utils.toInternalUSD(1), { from: notAnOwner })
                );
            });

            it('should revert if crowdsale already has been initialized', async () => {
                const owner = ctx.owners[0];
                await ctx.Lister.initCrowdsale(ctx.Token1.address, ctx.oneToken.mul(10), utils.toInternalUSD(1), {from: owner});
                await utils.shouldFail.reverting(
                    ctx.Lister.initCrowdsale(ctx.Token1.address, ctx.oneToken.mul(10), utils.toInternalUSD(1), {from: owner})
                );
            });
        });

        describe('restrictions', () => {
            const ctx = {};

            before(async () => {
                const oneToken = ctx.oneToken = BigNumber.TEN.pow(18);
                const result = await createLister(accounts[0]);

                ctx.owners = [accounts[1], accounts[2]];
                ctx.Lister = result.Lister;
                ctx.CrowdsaleFactory = result.CrowdsaleFactory;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);

                await mintAndApprove(ctx.Token1, ctx.owners, ctx.Lister.address, oneToken.mul(100));

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners, [0, 0, 0, 0], [], []
                );
                await ctx.Lister.placeToken(ctx.Token1.address, 0, oneToken.mul(10), {from: ctx.owners[0]});
            });

            it('should call addAdmin on the crowdsale', async () => {
                const owner = ctx.owners[0];
                await ctx.Lister.initCrowdsale(ctx.Token1.address, ctx.oneToken.mul(5), utils.toInternalUSD(1), {from: owner});
                const [crowdsaleAddress] = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                const callResult = await (W12Lister__W12CrowdsaleMock.at(crowdsaleAddress))._addAdminCall();

                callResult.should.to.equal(owner);
            });

            it('should call addAdmin on the fund', async () => {
                const owner = ctx.owners[0];
                const [crowdsaleAddress] = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                const crowdsale = W12Lister__W12CrowdsaleMock.at(crowdsaleAddress);
                const fund = W12Lister__W12FundMock.at(await crowdsale.getFund());
                const callResult = await fund._addAdminCall();

                callResult.should.to.equal(owner);
            });
        });

        describe('initialize', () => {
            const ctx = {};

            before(async () => {
                const oneToken = ctx.oneToken = BigNumber.TEN.pow(18);
                const result = await createLister(accounts[0]);

                ctx.owners = [accounts[1], accounts[2]];
                ctx.Lister = result.Lister;
                ctx.CrowdsaleFactory = result.CrowdsaleFactory;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);

                await mintAndApprove(ctx.Token1, ctx.owners, ctx.Lister.address, oneToken.mul(100));

                const owner = ctx.owners[0];

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners, [0, 100, 100, 100],
                    [paymentMethodA, paymentMethodB],
                    [purchaseFeeZero, purchaseFeeMax]
                );
                await ctx.Lister.placeToken(ctx.Token1.address, 0, oneToken.mul(10), {from: ctx.owners[0]});
                await ctx.Lister.initCrowdsale(ctx.Token1.address, ctx.oneToken.mul(5), utils.toInternalUSD(1), {from: owner});
            });

            it('should replace zero crowdsale address with new created', async () => {
                const actualList = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                actualList.should.to.not.deep.equal([utils.ZERO_ADDRESS]);
            });

            it('should`t confirm existence of crowdsale with zero address', async () => {
                const actualResult = await ctx.Lister.hasCrowdsaleWithAddress(ctx.Token1.address, 0);
                actualResult.should.to.be.false;
            });

            it('should`t confirm existence of not initialized crowdsale', async () => {
                const actualResult = await ctx.Lister.hasNotInitialisedCrowdsale(ctx.Token1.address);
                actualResult.should.to.be.false;
            });

            it('should correctly fill all parameters of initialized crowdsale', async () => {
                const [crowdsaleAddress] = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                const actualRecord = await ctx.Lister.getCrowdsale(ctx.Token1.address, crowdsaleAddress);

                actualRecord[0].map(i => i.toNumber()).should.to.deep.equal([0, 100, 100, 100]);
                actualRecord[1].map(i => i.toNumber()).should.to.deep.equal([ctx.oneToken.mul(10).toNumber(), ctx.oneToken.mul(5).toNumber()]);
                actualRecord[2].should.to.deep.equal(ctx.owners);
                actualRecord[3].map(i => web3.toUtf8(i)).should.to.deep.equal([web3.toUtf8(paymentMethodA), web3.toUtf8(paymentMethodB)]);
                actualRecord[4].map(i => i.toNumber()).should.to.deep.equal([purchaseFeeZero, purchaseFeeMax]);
            });

            it('should call crowdsale factory with owners', async () => {
                const callResult = await ctx.CrowdsaleFactory._createCrowdsaleCall();

                callResult[8].should.to.deep.equal(ctx.owners);
            });

            it('should call update purchase fee parameters on crowdsale', async () => {
                const [crowdsaleAddress] = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                const crowdsale = W12Lister__W12CrowdsaleMock.at(crowdsaleAddress);
                const callResults = await getUpdatePurchaseFeeParameterCalls(crowdsale);

                callResults.length.should.to.equal(2);
                callResults[0].symbol.should.to.eq(web3.toUtf8(paymentMethodA));
                callResults[0].has.should.to.be.true;
                callResults[0].value.should.bignumber.eq(purchaseFeeZero);
                callResults[1].symbol.should.to.eq(web3.toUtf8(paymentMethodB));
                callResults[1].has.should.to.be.true;
                callResults[1].value.should.bignumber.eq(purchaseFeeMax);
            });
        });

        describe('adding a new not initialized crowdsale', () => {
            const ctx = {};

            before(async () => {
                const oneToken = ctx.oneToken = BigNumber.TEN.pow(18);
                const result = await createLister(accounts[0]);

                ctx.owners = [accounts[1], accounts[2]];
                ctx.Lister = result.Lister;
                ctx.CrowdsaleFactory = result.CrowdsaleFactory;
                ctx.Token1 = await ERC20Mock.new('1', '1', 18);

                await mintAndApprove(ctx.Token1, ctx.owners, ctx.Lister.address, oneToken.mul(100));

                const owner = ctx.owners[0];

                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners, [0, 100, 100, 100], [], []
                );
                await ctx.Lister.placeToken(ctx.Token1.address, 0, oneToken.mul(10), {from: ctx.owners[0]});
                await ctx.Lister.initCrowdsale(ctx.Token1.address, ctx.oneToken.mul(5), utils.toInternalUSD(1), {from: owner});
                ctx.crowdsales = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                await ctx.Lister.whitelistToken(
                    ctx.Token1.address, '1', '1', 18, ctx.owners, [0, 100, 100, 100], [], []
                );
            });

            it('should add a not initialized to list', async () => {
                const actualList = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                actualList.should.to.deep.equal(ctx.crowdsales.concat([utils.ZERO_ADDRESS]));
            });

            it('should confirm existence of crowdsale with zero address', async () => {
                const actualResult = await ctx.Lister.hasCrowdsaleWithAddress(ctx.Token1.address, 0);
                actualResult.should.to.be.true;
            });

            it('should confirm existence of not initialized crowdsale', async () => {
                const actualResult = await ctx.Lister.hasNotInitialisedCrowdsale(ctx.Token1.address);
                actualResult.should.to.be.true;
            });

            it('should correctly fill all parameters of not initialized crowdsale', async () => {
                const [crowdsaleAddress, notInitialized] = await ctx.Lister.getCrowdsales(ctx.Token1.address);
                const actualRecord = await ctx.Lister.getCrowdsale(ctx.Token1.address, notInitialized);

                actualRecord[0].map(i => i.toNumber()).should.to.deep.equal([0, 0, 0, 0]);
                actualRecord[1].map(i => i.toNumber()).should.to.deep.equal([0, 0]);
                actualRecord[2].should.to.deep.equal([]);
                actualRecord[3].should.to.deep.equal([]);
                actualRecord[4].should.to.deep.equal([]);
            });
        });
    });
});
