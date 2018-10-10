require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const CrowdsaleFixture = require('../fixtures/crowdsale.js');
const TokenFixture = require('../fixtures/tokens.js');
const FundFixture = require('../fixtures/fund.js');

const testRecordingPurchaseToTheFund = require('../parts/recordingPurchaseToTheFund');
const testTrancheRelease = require('../parts/trancheRelease');
const W12Fund = artifacts.require('W12Fund');
const Rates = artifacts.require('Rates');
const Token = artifacts.require('WToken');
const W12FundStub = artifacts.require('W12FundStub');
const W12FundCrowdsaleStub = artifacts.require('W12FundCrowdsaleStub');
const oneToken = new BigNumber(10).pow(18);
const defaultStagesGenerator = utils.createStagesGenerator();
const defaultMilestonesGenerator = utils.createMilestonesGenerator();
const stagesDefaultFixture = (startDate) => defaultStagesGenerator([
    {
        dates: [
            startDate + utils.time.duration.minutes(40),
            startDate + utils.time.duration.minutes(60),
        ]
    },
    {
        dates: [
            startDate + utils.time.duration.minutes(80),
            startDate + utils.time.duration.minutes(100),
        ]
    },
    {
        dates: [
            startDate + utils.time.duration.minutes(120),
            startDate + utils.time.duration.minutes(140),
        ]
    }
]);
const milestonesDefaultFixture = (startDate) => defaultMilestonesGenerator([
    {
        endDate: startDate + utils.time.duration.days(10),
        voteEndDate: startDate + utils.time.duration.days(17),
        withdrawalWindow: startDate + utils.time.duration.days(20)
    },
    {
        endDate: startDate + utils.time.duration.days(21),
        voteEndDate: startDate + utils.time.duration.days(27),
        withdrawalWindow: startDate + utils.time.duration.days(30)
    }
]);
const setupMilestoneMockData = async (index, milestones, crowdsale) => {
    milestones = milestones.map(m => utils.encodeMilestoneParameters(
        m.name,
        m.description,
        m.tranchePercent,
        m.endDate,
        m.voteEndDate,
        m.withdrawalWindow
    ));
    await crowdsale._getCurrentMilestoneIndexMockData(index, true);
    await crowdsale._getLastMilestoneIndexMockData(milestones.length - 1, true);
    for (const milestoneIndex in milestones) {
        await crowdsale._getMilestoneMockData(
            milestoneIndex,
            milestones[milestoneIndex].dates[0],
            milestones[milestoneIndex].tranchePercent,
            milestones[milestoneIndex].dates[1],
            milestones[milestoneIndex].dates[2],
            milestones[milestoneIndex].nameHex,
            milestones[milestoneIndex].descriptionHex
        );
    }
};

contract('W12Fund', async (accounts) => {
    let sut, swap, crowdsale;
    let crowdsaleFixture, milestonesFixture, tokenFixture, originTokenFixture, stagesFixture;
    const sutOwner = accounts[7];
    const tokenOwner = accounts[1];
    const buyer1 = accounts[3];
    const buyer2 = accounts[4];
    const trancheFeePercent = new BigNumber(utils.toInternalPercent(5));

    describe.skip('creation and initialisation', async () => {
        const ctx = {};
        const ratesAddress = utils.generateRandomAddress();

        it('should create', async () => {
            W12Fund.new(0, utils.toInternalPercent(10), ratesAddress)
                .should.to.be.fulfilled;
        });

        describe('should initialise', () => {

            beforeEach(async () => {
                ctx.contract = await W12Fund.new(0, utils.toInternalPercent(10), ratesAddress);
            });

            it('rates address', async () => {
                const actual = await ctx.contract.rates();

                actual.should.to.be.eq(ratesAddress);
            });

            it('crowdsale address with zero', async () => {
                const actual = await ctx.contract.crowdsale();

                actual.should.to.be.eq(utils.ZERO_ADDRESS);
            });

            it('wToken address with zero', async () => {
                const actual = await ctx.contract.wToken();

                actual.should.to.be.eq(utils.ZERO_ADDRESS);
            });

            it('swap address with zero', async () => {
                const actual = await ctx.contract.swap();

                actual.should.to.be.eq(utils.ZERO_ADDRESS);
            });

            it('serviceWallet address with zero', async () => {
                const actual = await ctx.contract.serviceWallet();

                actual.should.to.be.eq(utils.ZERO_ADDRESS);
            });

            it('tranche fee percent', async () => {
                const actual = await ctx.contract.trancheFeePercent();

                actual.should.bignumber.eq(utils.toInternalPercent(10));
            });

            it('total tranche percent released with zero', async () => {
                const actual = await ctx.contract.totalTranchePercentReleased();

                actual.should.bignumber.eq(0);
            });

            it('total token bought with zero', async () => {
                const actual = await ctx.contract.totalTokenBought();

                actual.should.bignumber.eq(0);
            });

            it('total token refunded with zero', async () => {
                const actual = await ctx.contract.totalTokenRefunded();

                actual.should.bignumber.eq(0);
            });

            it('total funded assets list with empty list', async () => {
                const actual = await ctx.contract.getTotalFundedAssetsSymbols();

                actual.should.to.be.a('array');
                actual.length.should.to.be.eq(0);
            });
        });

        describe('should not initialise', () => {

            it('if tranche fee percent too big', async () => {
                await W12Fund.new(0, utils.toInternalPercent(100), ratesAddress)
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('if rates address is zero', async () => {
                await W12Fund.new(0, utils.toInternalPercent(99), utils.ZERO_ADDRESS)
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });
        });

        describe('setting', () => {

            beforeEach(async () => {
                ctx.contract = await W12Fund.new(0, utils.toInternalPercent(10), ratesAddress);
            });

            describe('crowdsale', () => {
                const tokenAddress = utils.generateRandomAddress();

                describe('should successful set', () => {
                    beforeEach(async () => {
                        ctx.crowdsale = await W12FundCrowdsaleStub.new(0);

                        await ctx.crowdsale._getWTokenMockData(tokenAddress);

                        ctx.Tx = ctx.contract.setCrowdsale(ctx.crowdsale.address);
                    });

                    it('crowdsale address', async () => {
                        await ctx.Tx;

                        const actual = await ctx.contract.crowdsale();

                        actual.should.to.be.eq(ctx.crowdsale.address);
                    });

                    it('wtoken address from crowdsale', async () => {
                        await ctx.Tx;

                        const actual = await ctx.contract.wToken();

                        actual.should.to.be.eq(tokenAddress);
                    });
                });

                describe('should revert when', () => {
                    it('crowdsale address is zero', async () => {
                        await ctx.contract.setCrowdsale(utils.ZERO_ADDRESS)
                            .should.to.be.rejectedWith(utils.EVMRevert);
                    });

                    it('wtoken address is zero', async () => {
                        ctx.crowdsale = await W12FundCrowdsaleStub.new(0);

                        await ctx.contract.setCrowdsale(ctx.crowdsale.address)
                            .should.to.be.rejectedWith(utils.EVMRevert);
                    });
                });
            });

            describe('swap', () => {
                const swapAddress = utils.generateRandomAddress();

                describe('should successful set', () => {

                    beforeEach(async () => {
                        ctx.Tx = ctx.contract.setSwap(swapAddress);
                    });

                    it('swap address', async () => {
                        await ctx.Tx;

                        const actual = await ctx.contract.swap();

                        actual.should.to.be.eq(swapAddress);
                    });
                });

                describe('should revert when', () => {

                    it('swap address is zero', async () => {
                        await ctx.contract.setSwap(utils.ZERO_ADDRESS)
                            .should.to.be.rejectedWith(utils.EVMRevert);
                    });
                });
            });

            describe('service wallet', () => {
                const serviceWallet = utils.generateRandomAddress();

                describe('should successful set', () => {

                    beforeEach(async () => {
                        ctx.Tx = ctx.contract.setServiceWallet(serviceWallet);
                    });

                    it('service wallet address', async () => {
                        await ctx.Tx;

                        const actual = await ctx.contract.serviceWallet();

                        actual.should.to.be.eq(serviceWallet);
                    });
                });

                describe('should revert when', () => {

                    it('service wallet address is zero', async () => {
                        await ctx.contract.setServiceWallet(utils.ZERO_ADDRESS)
                            .should.to.be.rejectedWith(utils.EVMRevert);
                    });
                });
            });
        });
    });

    describe.skip('recording purchases', async () => {

        describe('for payment with token', () => {
            const TokenSymbol = 'TTT';
            const TokenSymbolBytes32 = web3.fromUtf8(TokenSymbol);
            const investor = accounts[7];
            const crowdsale = accounts[6];
            const oneToken = BigNumber.TEN.pow(18);
            const mint = oneToken.mul(1000);
            const costUSD = oneToken.mul(1001);
            const ctx = {};

            beforeEach(async () => {
                ctx.rates = await Rates.new();
                ctx.token = await Token.new(TokenSymbol, TokenSymbol, 18);
            });

            describe('should successful', () => {
                const tokenAmount = new BigNumber(1000);

                beforeEach(async () => {
                    ctx.contract = await W12FundStub.new(
                        0, crowdsale, utils.generateRandomAddress(), utils.generateRandomAddress(),
                        utils.generateRandomAddress(), utils.toInternalPercent(0),
                        ctx.rates.address
                    );

                    await ctx.rates.addSymbolWithTokenAddress(TokenSymbolBytes32, ctx.token.address);
                    await ctx.token.mint(ctx.contract.address, mint, 0);

                    ctx.Tx = ctx.contract.recordPurchase(
                        investor, tokenAmount, TokenSymbolBytes32, mint, costUSD, {from: crowdsale}
                    );

                    ctx.expectedTotalBoughtTokenAmount = tokenAmount
                    ctx.expectedTotalFundedAmount = mint;
                    ctx.expectedTotalFundedUSDAmount = costUSD;
                    ctx.expectedInvestorTokenBoughtAmount = tokenAmount;
                    ctx.expectedInvestorTotalTokenBoughtAmount = tokenAmount;
                    ctx.expectedCostAmount = mint;
                    ctx.expectedFundedAmount = mint;
                    ctx.expectedFundedUSDAmount = costUSD;
                    ctx.expectedTotalFundedAssetsSymbols = ['USD', TokenSymbol];
                    ctx.expectedFundedAssetsSymbols = ['USD', TokenSymbol];
                    ctx.investorAddress = investor
                    ctx.Symbol = TokenSymbol;
                });

                testRecordingPurchaseToTheFund(ctx);

                describe('record another purchase and', () => {

                    beforeEach(async () => {
                        await ctx.token.mint(ctx.contract.address, mint, 0);

                        ctx.Tx = ctx.contract.recordPurchase(
                            investor, tokenAmount, TokenSymbolBytes32, mint, costUSD, {from: crowdsale}
                        );

                        ctx.expectedTotalBoughtTokenAmount= tokenAmount.add(tokenAmount);
                        ctx.expectedTotalFundedAmount = mint.add(mint);
                        ctx.expectedTotalFundedUSDAmount = costUSD.add(costUSD);
                        ctx.expectedInvestorTokenBoughtAmount = tokenAmount;
                        ctx.expectedInvestorTotalTokenBoughtAmount = tokenAmount.add(tokenAmount);
                        ctx.expectedCostAmount = mint;
                        ctx.expectedFundedAmount = mint.add(mint);
                        ctx.expectedFundedUSDAmount = costUSD.add(costUSD);
                    });

                    testRecordingPurchaseToTheFund(ctx);
                });
            });
        });

        describe('for payment with eth', () => {
            const ETHSymbol = 'ETH';
            const ETHSymbolBytes32 = web3.fromUtf8(ETHSymbol);
            const investor = accounts[7];
            const crowdsale = accounts[6];
            const cost = new BigNumber(1000);
            const costUSD = cost.mul(1.5);
            const ctx = {};

            beforeEach(async () => {
                ctx.rates = await Rates.new();
                ctx.token = await Token.new(ETHSymbol, ETHSymbol, 18);
            });

            describe('should successful', () => {
                const tokenAmount = new BigNumber(1000);

                beforeEach(async () => {
                    await ctx.rates.addSymbol(ETHSymbolBytes32);

                    ctx.contract = await W12FundStub.new(
                        0, crowdsale, utils.generateRandomAddress(), utils.generateRandomAddress(),
                        utils.generateRandomAddress(), utils.toInternalPercent(0),
                        ctx.rates.address
                    );

                    ctx.Tx = ctx.contract.recordPurchase(
                        investor, tokenAmount, ETHSymbolBytes32, cost, costUSD, {from: crowdsale, value: cost}
                    );

                    ctx.expectedTotalBoughtTokenAmount = tokenAmount
                    ctx.expectedTotalFundedAmount = cost;
                    ctx.expectedTotalFundedUSDAmount = costUSD;
                    ctx.expectedInvestorTokenBoughtAmount = tokenAmount;
                    ctx.expectedInvestorTotalTokenBoughtAmount = tokenAmount;
                    ctx.expectedCostAmount = cost;
                    ctx.expectedFundedAmount = cost;
                    ctx.expectedFundedUSDAmount = costUSD;
                    ctx.expectedTotalFundedAssetsSymbols = ['USD', ETHSymbol];
                    ctx.expectedFundedAssetsSymbols = ['USD', ETHSymbol];
                    ctx.investorAddress = investor
                    ctx.Symbol = ETHSymbol;
                });

                testRecordingPurchaseToTheFund(ctx);

                describe('record another purchase and', () => {

                    beforeEach(async () => {
                        ctx.Tx = ctx.contract.recordPurchase(
                            investor, tokenAmount, ETHSymbolBytes32, cost, costUSD, {from: crowdsale, value: cost}
                        );

                        ctx.expectedTotalBoughtTokenAmount = tokenAmount.add(tokenAmount);
                        ctx.expectedTotalFundedAmount = cost.add(cost);
                        ctx.expectedTotalFundedUSDAmount = costUSD.add(costUSD);
                        ctx.expectedInvestorTokenBoughtAmount = tokenAmount;
                        ctx.expectedInvestorTotalTokenBoughtAmount = tokenAmount.add(tokenAmount);
                        ctx.expectedCostAmount = cost;
                        ctx.expectedFundedAmount = cost.add(cost);
                        ctx.expectedFundedUSDAmount = costUSD.add(costUSD);
                    });

                    testRecordingPurchaseToTheFund(ctx);
                });
            });
        });

        describe('should revert when', () => {
            const investor = accounts[7];
            const crowdsale = accounts[6];
            const notCrowdsale = accounts[5];
            const ctx = {};

            beforeEach(async () => {
                ctx.rates = await Rates.new();
                ctx.token = await Token.new('TTT', 'TTT', 18);
                ctx.contract = await W12FundStub.new(
                    0, crowdsale, utils.generateRandomAddress(), utils.generateRandomAddress(),
                    utils.generateRandomAddress(), utils.toInternalPercent(0),
                    ctx.rates.address
                );

                await ctx.rates.addSymbol(web3.fromUtf8('ETH'));
                await ctx.rates.addSymbolWithTokenAddress(web3.fromUtf8('TTT'), ctx.token.address);
            });

            it('token amount is zero', async () => {
                await ctx.contract.recordPurchase(investor, 0, web3.fromUtf8('ETH'), 1, 1, {from: crowdsale, value: 1})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('cost amount is zero', async () => {
                await ctx.contract.recordPurchase(investor, 1, web3.fromUtf8('ETH'), 0, 1, {from: crowdsale, value: 1})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('cost usd amount is zero', async () => {
                await ctx.contract.recordPurchase(investor, 1, web3.fromUtf8('ETH'), 1, 0, {from: crowdsale, value: 1})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('investor address is zero', async () => {
                await ctx.contract.recordPurchase(0, 1, web3.fromUtf8('ETH'), 1, 1, {from: crowdsale, value: 1})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('unknown symbol', async () => {
                await ctx.contract.recordPurchase(investor, 1, web3.fromUtf8('AAA'), 1, 1, {from: crowdsale})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('msg.value less then cost', async () => {
                await ctx.contract.recordPurchase(investor, 1, web3.fromUtf8('ETH'), 2, 1, {from: crowdsale, value: 1})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('symbol is not a token', async () => {
                await ctx.rates.addSymbol(web3.fromUtf8('TT2'));

                await ctx.contract.recordPurchase(investor, 1, web3.fromUtf8('TT2'), 1, 1, {from: crowdsale, value: 1})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('fund balance was not filled with payment token', async () => {
                await ctx.contract.recordPurchase(investor, 1, web3.fromUtf8('TTT'), 1, 1, {from: crowdsale})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('call from a not crowdsale address', async () => {
                const contract = await W12Fund.new(0, utils.toInternalPercent(0), ctx.rates.address);
                const crowdsale = await W12FundCrowdsaleStub.new(0);

                await crowdsale._getWTokenMockData(utils.generateRandomAddress());
                await contract.setCrowdsale(crowdsale.address);

                await contract.recordPurchase(investor, 1, web3.fromUtf8('ETH'), 1, 1, {from: notCrowdsale, value: 1})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });
        });
    });

    describe.skip('realising tranche', () => {
        const swapAddress = accounts[1];
        const crowdsaleOwner = accounts[2];
        const serviceWalletAddress = accounts[3];
        const fundOwner = accounts[4];

        describe('should successful', () => {
            const oneToken = BigNumber.TEN.pow(18);
            const fundedInToken = oneToken.mul(999);
            const fundedInETH = new BigNumber(777);
            const fundedInUSD = new BigNumber(888);
            const investor1 = utils.generateRandomAddress();
            const investor2 = utils.generateRandomAddress();
            const totalTokenBoughtAmount = oneToken.mul(1001);
            const ctx = {
                expectedTrancheFeePercent: utils.toInternalPercent(10)
            };

            beforeEach(async () => {
                ctx.nowDate = web3.eth.getBlock('latest').timestamp;
                ctx.milestones = milestonesDefaultFixture(ctx.nowDate);
                ctx.rates = await Rates.new();
                ctx.token = await Token.new('TTT', 'TTT', 18);
                ctx.crowdsale = await W12FundCrowdsaleStub.new(0, {crowdsaleOwner});
                ctx.contract = await W12FundStub.new(
                    0,
                    ctx.crowdsale.address,
                    swapAddress,
                    utils.generateRandomAddress(),
                    serviceWalletAddress,
                    ctx.expectedTrancheFeePercent,
                    ctx.rates.address,
                    { from: fundOwner }
                );

                await ctx.rates.addSymbol(web3.fromUtf8('ETH'));
                await ctx.rates.addSymbolWithTokenAddress(web3.fromUtf8('TTT'), ctx.token.address);
                await ctx.token.mint(ctx.contract.address, fundedInToken, 0);
                await ctx.contract.recordPurchase(
                    investor1, totalTokenBoughtAmount.div(2),
                    web3.fromUtf8('ETH'), fundedInETH,
                    fundedInUSD.div(2),
                    { value: fundedInETH }
                );
                await ctx.contract.recordPurchase(
                    investor2, totalTokenBoughtAmount.div(2),
                    web3.fromUtf8('TTT'), fundedInToken,
                    fundedInUSD.div(2)
                );
            });

            describe('release in milestone 1/2 and', () => {

                beforeEach(async () => {
                    await setupMilestoneMockData(0, ctx.milestones, ctx.crowdsale);
                    await utils.time.increaseTimeTo(ctx.milestones[0].endDate + 1);

                    ctx.Tx = () => ctx.contract.tranche({ from: fundOwner });
                    ctx.milestoneIndex = 0;
                    ctx.expectedTranchePercent = utils.toInternalPercent(50);
                    ctx.expectedTotalTranchePercentReleased = utils.toInternalPercent(50);
                    ctx.serviceWalletAddress = serviceWalletAddress;
                    ctx.fundOwner = fundOwner;
                });

                testTrancheRelease(ctx);
            });

            describe('release in milestone 2/2 and', () => {

                beforeEach(async () => {
                    await setupMilestoneMockData(0, ctx.milestones, ctx.crowdsale);
                    await utils.time.increaseTimeTo(ctx.milestones[0].endDate + 1);
                    await ctx.contract.tranche({from: fundOwner});

                    await setupMilestoneMockData(1, ctx.milestones, ctx.crowdsale);
                    await utils.time.increaseTimeTo(ctx.milestones[1].withdrawalWindow + utils.time.duration.minutes(10));

                    ctx.Tx = () => ctx.contract.tranche({from: fundOwner});
                    ctx.milestoneIndex = 1;
                    ctx.expectedTranchePercent = utils.toInternalPercent(50);
                    ctx.expectedTotalTranchePercentReleased = utils.toInternalPercent(100);
                    ctx.serviceWalletAddress = serviceWalletAddress;
                    ctx.fundOwner = fundOwner;
                });

                testTrancheRelease(ctx);
            });

            describe('release not released tranche from milestone 1/2 in milestone 2/2 and', () => {

                beforeEach(async () => {
                    await setupMilestoneMockData(1, ctx.milestones, ctx.crowdsale);
                    await utils.time.increaseTimeTo(ctx.milestones[1].withdrawalWindow + utils.time.duration.minutes(10));

                    ctx.Tx = () => ctx.contract.tranche({from: fundOwner});
                    ctx.milestoneIndex = 1;
                    ctx.expectedTranchePercent = utils.toInternalPercent(100);
                    ctx.expectedTotalTranchePercentReleased = utils.toInternalPercent(100);
                    ctx.serviceWalletAddress = serviceWalletAddress;
                    ctx.fundOwner = fundOwner;
                });

                testTrancheRelease(ctx);
            });
        });

        describe('should revert', () => {
            const oneToken = BigNumber.TEN.pow(18);
            const fundedInToken = oneToken.mul(999);
            const fundedInETH = new BigNumber(777);
            const fundedInUSD = new BigNumber(888);
            const investor1 = utils.generateRandomAddress();
            const investor2 = utils.generateRandomAddress();
            const totalTokenBoughtAmount = oneToken.mul(1001);
            const ctx = {
                expectedTrancheFeePercent: utils.toInternalPercent(10)
            };

            beforeEach(async () => {
                ctx.nowDate = web3.eth.getBlock('latest').timestamp;
                ctx.milestones = milestonesDefaultFixture(ctx.nowDate);
                ctx.rates = await Rates.new();
                ctx.token = await Token.new('TTT', 'TTT', 18);
                ctx.crowdsale = await W12FundCrowdsaleStub.new(0, {crowdsaleOwner});
                ctx.contract = await W12FundStub.new(
                    0,
                    ctx.crowdsale.address,
                    swapAddress,
                    utils.generateRandomAddress(),
                    serviceWalletAddress,
                    ctx.expectedTrancheFeePercent,
                    ctx.rates.address,
                    {from: fundOwner}
                );

                await ctx.rates.addSymbol(web3.fromUtf8('ETH'));
                await ctx.rates.addSymbolWithTokenAddress(web3.fromUtf8('TTT'), ctx.token.address);
                await ctx.token.mint(ctx.contract.address, fundedInToken, 0);
                await ctx.contract.recordPurchase(
                    investor1, totalTokenBoughtAmount.div(2),
                    web3.fromUtf8('ETH'), fundedInETH,
                    fundedInUSD.div(2),
                    {value: fundedInETH}
                );
                await ctx.contract.recordPurchase(
                    investor2, totalTokenBoughtAmount.div(2),
                    web3.fromUtf8('TTT'), fundedInToken,
                    fundedInUSD.div(2)
                );
            });

            it('if crowdsale was not end', async() => {
                await ctx.contract.tranche({from: fundOwner})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('if withdrawal window is not active', async () => {
                await setupMilestoneMockData(1, ctx.milestones, ctx.crowdsale);
                await utils.time.increaseTimeTo(ctx.milestones[1].endDate + 1);

                await ctx.contract.tranche({from: fundOwner})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('if already released', async () => {
                await setupMilestoneMockData(0, ctx.milestones, ctx.crowdsale);
                await utils.time.increaseTimeTo(ctx.milestones[0].endDate);
                await ctx.contract.tranche({from: fundOwner})

                await ctx.contract.tranche({from: fundOwner})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('if the fund is empty', async () => {
                const contract = await W12FundStub.new(
                    0,
                    ctx.crowdsale.address,
                    swapAddress,
                    utils.generateRandomAddress(),
                    serviceWalletAddress,
                    ctx.expectedTrancheFeePercent,
                    ctx.rates.address,
                    {from: fundOwner}
                );
                await setupMilestoneMockData(0, ctx.milestones, ctx.crowdsale);
                await utils.time.increaseTimeTo(ctx.milestones[0].endDate);

                await contract.tranche({from: fundOwner})
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });
        });
    });

    describe.skip('refund', async () => {
        let crowdsaleMock, encodedMilestoneFixture, startData;

        const crowdsaleOwner = accounts[0];
        const mintAmount = oneToken.mul(10000);
        const tokenPrice = new BigNumber(1000);
        const setupMilestoneMockData = async (index) => {
            await crowdsaleMock._getCurrentMilestoneIndexMockData(index, true);
            await crowdsaleMock._getMilestoneMockData(
                index,
                encodedMilestoneFixture[index].dates[0],
                encodedMilestoneFixture[index].tranchePercent,
                encodedMilestoneFixture[index].dates[1],
                encodedMilestoneFixture[index].dates[2],
                encodedMilestoneFixture[index].nameHex,
                encodedMilestoneFixture[index].descriptionHex
            );
        };

        beforeEach(async () => {
            startData = web3.eth.getBlock('latest').timestamp;
            tokenFixture = await TokenFixture.createToken(tokenOwner);
            originTokenFixture = await TokenFixture.createToken(tokenOwner);
            milestonesFixture = milestonesDefaultFixture(startData);
            encodedMilestoneFixture = milestonesFixture
                .map(m =>
                    utils.encodeMilestoneParameters(
                        m.name,
                        m.description,
                        m.tranchePercent,
                        m.endDate,
                        m.voteEndDate,
                        m.withdrawalWindow
                    )
                )
            crowdsaleMock = await W12FundCrowdsaleStub.new(0, { crowdsaleOwner });
            sut = await W12FundStub.new(
                0,
                crowdsaleMock.address,
                utils.generateRandomAddress(),
                tokenFixture.token.address,
                utils.generateRandomAddress(),
                trancheFeePercent,
                {from: sutOwner}
            );

            await setupMilestoneMockData(0);
            await tokenFixture.token.mint(buyer1, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.mint(buyer2, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer1});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer2});
        });

        describe('getRefundAmount', async () => {

            for (const milestoneIndex of [1,2]) {
                it(`should calculate full refund amount after milestone #${milestoneIndex} in case with one investor`, async () => {
                    await setupMilestoneMockData(milestoneIndex);

                    const withdrawalEndDate = milestonesFixture[milestoneIndex].withdrawalWindow;
                    const purchaseTokens = new BigNumber(20);
                    const purchaseTokensRecord = oneToken.mul(20);
                    const purchaseCost = purchaseTokens.mul(tokenPrice);
                    const tokenDecimals = tokenFixture.args.decimals;

                    await utils.time.increaseTimeTo(withdrawalEndDate - 60);

                    await sut.recordPurchase(buyer1, purchaseTokensRecord, {
                        from: crowdsaleOwner,
                        value: purchaseCost
                    }).should.be.fulfilled;

                    const tokensToReturn = purchaseTokensRecord;
                    const expectedRefundAmount = utils.calculateRefundAmount(
                        purchaseCost,
                        purchaseCost,
                        purchaseCost,
                        purchaseTokensRecord,
                        tokensToReturn,
                        tokenDecimals
                    );

                    const refundAmount = await sut.getRefundAmount(tokensToReturn, {from: buyer1}).should.be.fulfilled;

                    refundAmount.should.bignumber.eq(expectedRefundAmount);
                });
            }

            it('partial refund in case with two investors', async () => {
                const withdrawalEndDate = milestonesFixture[0].withdrawalWindow;
                const records = [
                    {
                        buyer: buyer1,
                        tokens: new BigNumber(20),
                    },
                    {
                        buyer: buyer2,
                        tokens: new BigNumber(30),
                    }
                ];

                const tokenDecimals = tokenFixture.args.decimals;

                await utils.time.increaseTimeTo(withdrawalEndDate - 60);

                const recordsResult = await FundFixture.setPurchaseRecords(
                    sut,
                    records,
                    tokenPrice,
                    tokenDecimals,
                    crowdsaleOwner
                ).should.be.fulfilled;

                const tokensToReturn = recordsResult.args[1].boughtTokens.div(2); // 15 * 10 ** 18
                const expectedRefundAmount = utils.calculateRefundAmount(
                    recordsResult.totalCost,
                    recordsResult.totalCost,
                    recordsResult.args[1].cost,
                    recordsResult.args[1].boughtTokens,
                    tokensToReturn,
                    tokenDecimals
                );

                const refundAmount2 = await sut.getRefundAmount(tokensToReturn, {from: buyer2}).should.be.fulfilled;

                refundAmount2.should.bignumber.eq(expectedRefundAmount);
            });

            it('should not refund on non investor address', async () => {
                const withdrawalEndDate = milestonesFixture[0].withdrawalWindow;
                const records = [
                    {
                        buyer: buyer1,
                        tokens: new BigNumber(20),
                    },
                    {
                        buyer: buyer2,
                        tokens: new BigNumber(30),
                    }
                ];

                const tokenDecimals = tokenFixture.args.decimals;

                await utils.time.increaseTimeTo(withdrawalEndDate - 60);

                const recordsResult = await FundFixture.setPurchaseRecords(
                    sut,
                    records,
                    tokenPrice,
                    tokenDecimals,
                    crowdsaleOwner
                ).should.be.fulfilled;

                const tokensToReturn = recordsResult.args[0].boughtTokens;
                const refundAmount = await sut.getRefundAmount(tokensToReturn, {from: accounts[2]}).should.be.fulfilled;

                refundAmount.should.bignumber.eq(BigNumber.Zero);
            });
        });

        for (const milestoneIndex of [1, 2]) {
            it(`should refund buyer after milestone #${milestoneIndex} ended`, async () => {
                await setupMilestoneMockData(milestoneIndex);
                await utils.time.increaseTimeTo(milestonesFixture[milestoneIndex].withdrawalWindow - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);
                const tokensToReturn = oneToken.mul(20);
                const tokenDecimals = tokenFixture.args.decimals;

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                const expectedRefundAmount = utils.calculateRefundAmount(
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    tokens,
                    tokensToReturn,
                    tokenDecimals
                );

                const buyer1BalanceBefore = web3.eth.getBalance(buyer1);

                (await sut.totalRefunded()).should.bignumber.eq(0);

                const refundReceipt = await sut.refund(tokensToReturn, {from: buyer1})
                    .should.be.fulfilled;

                (await sut.totalRefunded()).should.bignumber.eq(expectedRefundAmount);

                const logs = refundReceipt.logs;
                const operationCost = await utils.getTransactionCost(refundReceipt);
                const investmentsInfoAfter = await sut.getInvestmentsInfo(buyer1).should.be.fulfilled;

                web3.eth.getBalance(sut.address).should.bignumber.eq(funds.minus(expectedRefundAmount));
                web3.eth.getBalance(buyer1).should.bignumber.eq(buyer1BalanceBefore.plus(expectedRefundAmount).minus(operationCost));

                investmentsInfoAfter[0].should.bignumber.equal(0);

                logs.length.should.be.equal(1);
                logs[0].event.should.be.equal('FundsRefunded');
                logs[0].args.buyer.should.be.equal(buyer1);
                logs[0].args.weiAmount.should.bignumber.eq(expectedRefundAmount);
                logs[0].args.tokenAmount.should.bignumber.eq(tokens);
            });

            it(`should allow refund between milestone ${milestoneIndex} end date and the end of withdrawal window`, async () => {
                await setupMilestoneMockData(milestoneIndex);
                await utils.time.increaseTimeTo(milestonesFixture[milestoneIndex].endDate + 5);
                (await sut.refundAllowed()).should.be.true;

                await utils.time.increaseTimeTo(milestonesFixture[milestoneIndex].withdrawalWindow - 5);
                (await sut.refundAllowed()).should.be.true;
            });
        }

        it('should reject refund if provide zero tokens', async () => {
            await utils.time.increaseTimeTo(milestonesFixture[0].withdrawalWindow - 60);

            const funds = new BigNumber(web3.toWei(0.1, 'ether'));
            const tokens = oneToken.mul(20);

            await sut.recordPurchase(buyer1, tokens, {
                from: crowdsaleOwner,
                value: funds
            }).should.be.fulfilled;

            await sut.refund(0, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should reject refund if provided tokens amount gte investment number', async () => {
            await utils.time.increaseTimeTo(milestonesFixture[0].voteEndDate - 60);

            const funds = new BigNumber(web3.toWei(0.1, 'ether'));
            const tokens = oneToken.mul(20);

            await sut.recordPurchase(buyer1, tokens, {
                from: crowdsaleOwner,
                value: funds
            }).should.be.fulfilled;

            await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should reject refund if address is not an investor address', async () => {
            await utils.time.increaseTimeTo(milestonesFixture[0].withdrawalWindow - 60);

            await sut.refund(1, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should reject refund if current time not in withdrawal window', async () => {
            const funds = new BigNumber(web3.toWei(0.1, 'ether'));
            const tokens = oneToken.mul(20);

            await sut.recordPurchase(buyer1, tokens, {
                from: crowdsaleOwner,
                value: funds
            }).should.be.fulfilled;

            await utils.time.increaseTimeTo(milestonesFixture[0].endDate - 60);

            await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);

            await utils.time.increaseTimeTo(milestonesFixture[0].withdrawalWindow + 60);

            await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });
    });
});
