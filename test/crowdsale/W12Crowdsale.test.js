require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');
const testFee = require('../parts/transferringFeeTests');
const testPurchase = require('../parts/transferringPurchaseTests');

const Token = artifacts.require('WToken');
const oneToken = new BigNumber(10).pow(18);
const helpers = require('../fixtures/W12Crowdsale');
const defaultStagesGenerator = utils.createStagesGenerator();
const defaultMilestonesGenerator = utils.createMilestonesGenerator();
const stagesDefaultFixture = (startDate) => defaultStagesGenerator({
    dates: [
        startDate + utils.time.duration.minutes(40),
        startDate + utils.time.duration.minutes(60),
    ],
    volumeBoundaries: [
        oneToken,
        oneToken.mul(2),
        oneToken.mul(10)
    ],
    volumeBonuses: [
        utils.toInternalPercent(1),
        utils.toInternalPercent(2),
        utils.toInternalPercent(3)
    ],
});
const milestonesDefaultFixture = (startDate) => defaultMilestonesGenerator({
    endDate: startDate + utils.time.duration.minutes(200),
    voteEndDate: startDate + utils.time.duration.minutes(230),
    withdrawalWindow: startDate + utils.time.duration.minutes(240)
});


contract('W12Crowdsale', async (accounts) => {
    const ten = new BigNumber(10);
    const swap = accounts[7];
    const serviceWallet = accounts[6];
    const owner = accounts[0];
    const WTokenPrice = 0.05; // USD
    const serviceFee = 10;
    const tranchePercent = 5;
    const saleFee = 10;
    const mint = new BigNumber(100000);
    const minted = [ten.pow(0).mul(mint), ten.pow(18).mul(mint), ten.pow(60).mul(mint)];

    let originTokens = [];
    let wtokens = [];
    let crowdsales = [];

    let startDate;
    let endDate;

    beforeEach(async () => {
        startDate = web3.eth.getBlock('latest').timestamp + 60;
        wtokens = await helpers.generateWTokens([0, 18, 60], owner);
        originTokens = await helpers.generateWTokens([0, 18, 60], owner);
        crowdsales = await helpers.generateW12CrowdsaleStubWithDifferentToken(
            {
                serviceWallet,
                swap,
                price: WTokenPrice,
                tranchePercent,
                serviceFee,
                saleFee,
                mint
            }, originTokens, wtokens, owner
        );
        startDate = web3.eth.getBlock('latest').timestamp + 60;
    });

    describe('constructor', async () => {
        it('should create crowdsale', async () => {
            const sut = crowdsales[0].crowdsale;
            const wtoken = wtokens[0].token;
            const originToken = originTokens[0].token;

            (await sut.token()).should.be.equal(wtoken.address);
            (await sut.originToken()).should.be.equal(originToken.address);
            (await sut.price()).should.bignumber.equal(utils.toInternalUSD(WTokenPrice));
            (await sut.serviceFee()).should.bignumber.equal(utils.toInternalPercent(serviceFee));
            (await sut.WTokenSaleFeePercent()).should.bignumber.equal(utils.toInternalPercent(saleFee));
            (await sut.serviceWallet()).should.be.equal(serviceWallet);
            (await sut.swap()).should.be.equal(swap);
        });
    });

    describe('setup', async () => {
        const paymentMethods = [
            'ETH',
            'TT',
        ];
        const paymentMethodsBytes32List = paymentMethods.map(m => web3.fromUtf8(m));
        let sut;

        beforeEach(async () => {
            sut = crowdsales[0].crowdsale;

            const token = await Token.new('TT', 'TT', 18);

            await crowdsales[0].rates.addSymbol(paymentMethodsBytes32List[0]);
            await crowdsales[0].rates.addSymbolWithTokenAddress(paymentMethodsBytes32List[1], token.address);
        });

        describe('should setup', async () => {
            let stages, milestones, params, txOut;

            beforeEach(async () => {
                stages = defaultStagesGenerator([
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ],
                        volumeBoundaries: [
                            oneToken,
                            oneToken.mul(2),
                            oneToken.mul(10)
                        ],
                        volumeBonuses: [
                            utils.toInternalPercent(1),
                            utils.toInternalPercent(2),
                            utils.toInternalPercent(3)
                        ],
                    },
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(70),
                            startDate + utils.time.duration.minutes(90),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(210),
                        discount: utils.toInternalPercent(5)
                    },
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: utils.toInternalPercent(10),
                        volumeBoundaries: [
                            oneToken,
                            oneToken.mul(2),
                            oneToken.mul(10)
                        ],
                        volumeBonuses: [
                            utils.toInternalPercent(1),
                            utils.toInternalPercent(2),
                            utils.toInternalPercent(3)
                        ],
                    }
                ]);
                milestones = defaultMilestonesGenerator([
                    {
                        name: "Milestone 1",
                        description: "Milestone 1",
                        endDate: startDate + utils.time.duration.minutes(200),
                        voteEndDate: startDate + utils.time.duration.minutes(230),
                        withdrawalWindow: startDate + utils.time.duration.minutes(240),
                        tranchePercent: utils.toInternalPercent(50)
                    },
                    {
                        name: "Milestone 2",
                        description: "Milestone 2",
                        endDate: startDate + utils.time.duration.minutes(260),
                        voteEndDate: startDate + utils.time.duration.minutes(280),
                        withdrawalWindow: startDate + utils.time.duration.minutes(300),
                        tranchePercent: utils.toInternalPercent(50)
                    }
                ]);
                params = utils.packSetupCrowdsaleParameters(stages, milestones, paymentMethodsBytes32List);
                txOut = sut.setup(...params, {from: owner});
            });

            it('should success', async () => {
                await txOut
                    .should.be.fulfilled;
            });

            it('should set stages', async () => {
                await txOut;

                for (const index in stages) {
                    const stage = stages[index];
                    const actualStage = await sut.getStage(index);

                    actualStage[0].should.bignumber.eq(stage.dates[0]);
                    actualStage[1].should.bignumber.eq(stage.dates[1]);
                    actualStage[2].should.bignumber.eq(stage.discount);
                    actualStage[3].should.bignumber.eq(stage.vestingTime);
                    actualStage[4].every((n, i) => n.eq(stage.volumeBoundaries[i])).should.be.true;
                    actualStage[5].every((n, i) => n.eq(stage.volumeBonuses[i])).should.be.true;
                }
            });

            it('should set milestones', async () => {
                await txOut;

                for (const index in milestones) {
                    const milestone = milestones[index];
                    const encoded = utils.encodeMilestoneParameters(
                        milestone.name,
                        milestone.description,
                        milestone.tranchePercent,
                        milestone.endDate,
                        milestone.voteEndDate,
                        milestone.withdrawalWindow
                    );
                    const actualMilestone = await sut.getMilestone(index);

                    actualMilestone[0].should.bignumber.eq(milestone.endDate);
                    actualMilestone[1].should.bignumber.eq(milestone.tranchePercent);
                    actualMilestone[2].should.bignumber.eq(milestone.voteEndDate);
                    actualMilestone[3].should.bignumber.eq(milestone.withdrawalWindow);
                    actualMilestone[4].should.be.eq(encoded.nameHex);
                    actualMilestone[5].should.be.eq(encoded.descriptionHex);
                }
            });

            it('should set payment methods', async () => {
                const actual = await sut.getPaymentMethodsList();

                actual.should.to.be.a('array');
                actual.length.should.to.be.eq(2);
                web3.toUtf8(actual[0]).should.to.be.eq(paymentMethods[0]);
                web3.toUtf8(actual[1]).should.to.be.eq(paymentMethods[1]);
            });
        });

        it('should revert if stages is not in ascending order', async () => {
            const stages = defaultStagesGenerator([
                {
                    dates: [
                        startDate + utils.time.duration.minutes(70),
                        startDate + utils.time.duration.minutes(90),
                    ]
                },
                {
                    dates: [
                        startDate + utils.time.duration.minutes(40),
                        startDate + utils.time.duration.minutes(60),
                    ]
                }
            ]);
            const params = utils.packSetupCrowdsaleParameters(stages, milestonesDefaultFixture(startDate), paymentMethodsBytes32List);

            await sut.setup(...params, { from: owner })
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should accept single milestone', async () => {
            const stages = defaultStagesGenerator({
                dates: [
                    startDate + 10,
                    startDate + 20
                ]
            });
            const expectedMilestones = defaultMilestonesGenerator({
                name: "Single milestone",
                description: "Single milestone with 100% tranche",
                endDate: startDate + 300,
                voteEndDate: startDate + 600,
                withdrawalWindow: startDate + 1200
            });
            const encodedMilestones = expectedMilestones.map(item => {
                return utils.encodeMilestoneParameters(
                    item.name,
                    item.description,
                    item.tranchePercent,
                    item.endDate,
                    item.voteEndDate,
                    item.withdrawalWindow
                );
            });
            const params = utils.packSetupCrowdsaleParameters(stages, expectedMilestones, paymentMethodsBytes32List);

            await sut.setup(...params, {from: owner})
                .should.be.fulfilled;

            let actualMilestonesCount = await sut.milestonesLength().should.be.fulfilled;

            actualMilestonesCount.should.bignumber.equal(expectedMilestones.length);

            while (--actualMilestonesCount >= 0) {
                const milestone = await sut.milestones(actualMilestonesCount);

                milestone[0].should.bignumber.equal(expectedMilestones[actualMilestonesCount].endDate);
                milestone[1].should.bignumber.equal(expectedMilestones[actualMilestonesCount].tranchePercent);
                milestone[2].should.bignumber.equal(expectedMilestones[actualMilestonesCount].voteEndDate);
                milestone[3].should.bignumber.equal(expectedMilestones[actualMilestonesCount].withdrawalWindow);
                milestone[4].should.be.equal(encodedMilestones[actualMilestonesCount].nameHex);
                milestone[5].should.be.equal(encodedMilestones[actualMilestonesCount].descriptionHex);
            }
        });

        it('should revert if milestones is not in ascending order', async () => {
            const stages = defaultStagesGenerator({
                dates: [
                    startDate + 10,
                    startDate + 20
                ]
            });
            const milestones = defaultMilestonesGenerator([
                {
                    endDate: startDate + 1250,
                    voteEndDate: startDate + 1260,
                    withdrawalWindow: startDate + 1270
                },
                {
                    endDate: startDate + 60,
                    voteEndDate: startDate + 600,
                    withdrawalWindow: startDate + 1200
                }
            ]);
            const params = utils.packSetupCrowdsaleParameters(stages, milestones, paymentMethodsBytes32List);

            await sut.setup(...params, {from: owner}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should revert set stages if last stage end date after first milestone end date', async () => {
            const milestones = defaultMilestonesGenerator({
                endDate: startDate + 120,
                voteEndDate: startDate + 121,
                withdrawalWindow: startDate + 122
            });
            const discountStages = defaultStagesGenerator({
                dates: [
                    startDate + 120,
                    startDate + 121,
                ]
            });
            const params = utils.packSetupCrowdsaleParameters(discountStages, milestones, paymentMethodsBytes32List);

            await sut.setup(...params, { from: owner })
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should revert set milestones if first milestone end date before last stage end date', async () => {
            const milestones = defaultMilestonesGenerator({
                endDate: startDate + 120,
                voteEndDate: startDate + 121,
                withdrawalWindow: startDate + 122
            });
            const discountStages = defaultStagesGenerator({
                dates: [
                    startDate + 120,
                    startDate + 121,
                ]
            });
            const params = utils.packSetupCrowdsaleParameters(discountStages, milestones, paymentMethodsBytes32List);

            await sut.setup(...params, {from: owner})
                .should.be.rejectedWith(utils.EVMRevert);
        });

        describe('stages', async () => {
            let discountStages;

            beforeEach(async () => {
                discountStages = defaultStagesGenerator([
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ]
                    },
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(70),
                            startDate + utils.time.duration.minutes(90),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(210),
                        discount: utils.toInternalPercent(5)
                    },
                    {
                        name: 'Phase 10',
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: utils.toInternalPercent(10)
                    }
                ]);
                const params = utils.packSetupCrowdsaleParameters(discountStages, milestonesDefaultFixture(startDate), paymentMethodsBytes32List);

                await sut.setup(...params, {from: owner});
            });

            it('should return current stage', async () => {
                const expectedStage = discountStages[1];

                await utils.time.increaseTimeTo(expectedStage.dates[1] - 10);

                const result = await sut.getCurrentStageIndex().should.be.fulfilled;

                result[0].should.bignumber.equal(1);
                result[1].should.be.equal(true);
            });

            it('should\'t return current stage', async () => {
                const someStage1 = discountStages[1];
                const someStage2 = discountStages[2];
                const someDate = someStage1.dates[1] + Math.ceil((someStage2.dates[0] - someStage1.dates[1]) / 2);

                await utils.time.increaseTimeTo(someDate);

                const result = await sut.getCurrentStageIndex().should.be.fulfilled;

                result[0].should.bignumber.equal(0);
                result[1].should.be.equal(false);
            });

            it('should set stage bonuses', async () => {
                const stages = defaultStagesGenerator({
                    dates: [
                        startDate + utils.time.duration.minutes(40),
                        startDate + utils.time.duration.minutes(60),
                    ],
                    volumeBoundaries: [
                        oneToken,
                        oneToken.mul(2),
                        oneToken.mul(10)
                    ],
                    volumeBonuses: [
                        utils.toInternalPercent(1),
                        utils.toInternalPercent(2),
                        utils.toInternalPercent(3)
                    ]
                });
                const params = utils.packSetupCrowdsaleParameters(stages, milestonesDefaultFixture(startDate), paymentMethodsBytes32List);

                await sut.setup(...params, {from: owner})
                    .should.be.fulfilled;

                for(const index in stages[0].volumeBoundaries) {
                    const expectedBoundary = stages[0].volumeBoundaries[index];
                    const expectedBonus = stages[0].volumeBonuses[index];

                    (await sut.getStage(0))[4][index]
                        .should.be.bignumber.eq(expectedBoundary);
                    (await sut.getStage(0))[5][index]
                        .should.be.bignumber.eq(expectedBonus);
                }
            });

            it('should not set stage bonuses if volume boundaries is not in ascending order', async () => {
                const stages = defaultStagesGenerator({
                    dates: [
                        startDate + utils.time.duration.minutes(40),
                        startDate + utils.time.duration.minutes(60),
                    ],
                    volumeBoundaries: [
                        oneToken.mul(2),
                        oneToken,
                        oneToken.mul(10)
                    ],
                    volumeBonuses: [
                        utils.toInternalPercent(1),
                        utils.toInternalPercent(2),
                        utils.toInternalPercent(3)
                    ]
                });
                const params = utils.packSetupCrowdsaleParameters(stages, milestonesDefaultFixture(startDate), paymentMethodsBytes32List);

                await sut.setup(...params, {from: owner})
                    .should.be.rejectedWith(utils.EVMRevert);
            });

            it('should end at the end date', async () => {
                const endDate = discountStages[discountStages.length - 1].dates[1];
                await utils.time.increaseTimeTo(endDate + 10);

                (await sut.isEnded()).should.be.equal(true);
            });
        });

        describe('milestones', async () => {
            let discountStages;
            let expectedMilestones;
            let encodedMilestones;

            beforeEach(async () => {
                expectedMilestones = defaultMilestonesGenerator([
                    {
                        name: "Milestone 1 name",
                        description: "Milestone 2 description",
                        endDate: startDate + utils.time.duration.days(10),
                        voteEndDate: startDate + utils.time.duration.days(17),
                        withdrawalWindow: startDate + utils.time.duration.days(20)
                    },
                    {
                        name: "Milestone 2 name",
                        description: "Milestone 2 description",
                        endDate: startDate + utils.time.duration.days(21),
                        voteEndDate: startDate + utils.time.duration.days(27),
                        withdrawalWindow: startDate + utils.time.duration.days(30)
                    },
                    {
                        name: "Milestone 3 name",
                        description: "Milestone 3 description",
                        endDate: startDate + utils.time.duration.days(31),
                        voteEndDate: startDate + utils.time.duration.days(37),
                        withdrawalWindow: startDate + utils.time.duration.days(40)
                    }
                ]);
                discountStages = defaultStagesGenerator([
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ]
                    }
                ]);
                encodedMilestones = expectedMilestones.map(item => {
                    return utils.encodeMilestoneParameters(
                        item.name,
                        item.description,
                        item.tranchePercent,
                        item.endDate,
                        item.voteEndDate,
                        item.withdrawalWindow
                    );
                });
                const params = utils.packSetupCrowdsaleParameters(discountStages, expectedMilestones, paymentMethodsBytes32List);

                await sut.setup(...params, {from: owner})
                    .should.be.fulfilled;
            });

            it('should return current milestone index in case when current date between first and last milestone', async () => {
                let expectedIndex = 0;

                for (const milestone of expectedMilestones) {
                    await utils.time.increaseTimeTo(milestone.endDate - utils.time.duration.minutes(10));

                    const result = await sut.getCurrentMilestoneIndex()
                        .should.be.fulfilled;

                    result[0].should.bignumber.equal(expectedIndex);
                    result[1].should.be.equal(true);

                    expectedIndex++;
                }
            });

            it.skip('must check that the function returns the correct Milestone index for each date in the given array', async () => {
                const controlArray = [{
                    time: await utils.time.increaseTimeTo(discountStages[discountStages.length - 1].endDate) - utils.time.duration.minutes(1),
                    index: 0,
                    found: false
                }, {
                    time: startDate + utils.time.duration.days(15),
                    index: 0,
                    found: true
                }, {
                    time: startDate + utils.time.duration.days(20) - utils.time.duration.minutes(1),
                    index: 0,
                    found: true
                },{
                    time: startDate + utils.time.duration.days(20) - utils.time.duration.minutes(1),
                    index: 0,
                    found: true,
                },{
                    time: startDate + utils.time.duration.days(20) - 1,
                    index: 0,
                    found: true,
                },{
                    time: startDate + utils.time.duration.days(20) + utils.time.duration.minutes(1),
                    index: 1,
                    found: true,
                },{
                    time: startDate + utils.time.duration.days(30) + utils.time.duration.minutes(1),
                    index: 2,
                    found: true,
                },{
                    time: startDate + utils.time.duration.days(40) - 1,
                    index: 2,
                    found: true,
                },{
                    time: startDate + utils.time.duration.days(40) + utils.time.duration.minutes(1),
                    index: 2,
                    found: true,
                }];

                for (const elem of controlArray) {
                    await utils.time.increaseTimeTo(elem.time);

                    const result = await sut.getCurrentMilestoneIndex()
                        .should.be.fulfilled;

                    result[0].should.bignumber.equal(elem.index);
                    result[1].should.be.equal(elem.found);
                }
            });
        });
    });

    describe('token purchase process', async () => {
        const buyer = accounts[8];
        const notBuyer = accounts[7];
        const paymentMethods = [
            'ETH',
            'TTT',
        ];
        const paymentMethodsBytes32List = paymentMethods.map(m => web3.fromUtf8(m));
        let firstCrowdsale;
        let firstCrowdsaleFund;
        let firstCrowdsaleRates;
        let firstCrowdsaleWToken;
        let firstCrowdsaleOriginToken;
        let discountStages;
        let oneWToken;
        let oneOriginToken;

        const paymentTokenPrice = 1.5; // USD
        const paymentETHPrice = 2.5; // USD
        const paymentTokenDecimals = 20;
        const paymentTokenMinted = ten.pow(paymentTokenDecimals).mul(1000000);
        let paymentToken;

        beforeEach(async () => {
            firstCrowdsale = crowdsales[0].crowdsale;
            firstCrowdsaleFund = crowdsales[0].fund;
            firstCrowdsaleRates = crowdsales[0].rates;
            firstCrowdsaleWToken = crowdsales[0].wtoken;
            firstCrowdsaleOriginToken = crowdsales[0].originToken;
            oneWToken = new BigNumber(10).pow(await firstCrowdsaleWToken.decimals());
            oneOriginToken = new BigNumber(10).pow(await firstCrowdsaleOriginToken.decimals());
        });

        describe('buy', async () => {

            beforeEach(async () => {
                paymentToken = await Token.new(paymentMethods[1], paymentMethods[1], paymentTokenDecimals);
                discountStages = defaultStagesGenerator([
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ]
                    },
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(70),
                            startDate + utils.time.duration.minutes(90),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(210),
                        discount: utils.toInternalPercent(5),
                        volumeBoundaries: [utils.toInternalUSD(1)],
                        volumeBonuses: [utils.toInternalPercent(13)],
                    },
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: utils.toInternalPercent(10),
                        volumeBoundaries: [utils.toInternalUSD(1)],
                        volumeBonuses: [utils.toInternalPercent(23)],
                    }
                ]);

                await paymentToken.mint(buyer, paymentTokenMinted, 0);

                for (const item of crowdsales) {
                    const { crowdsale, rates } = item;
                    const params = utils.packSetupCrowdsaleParameters(discountStages, milestonesDefaultFixture(startDate), paymentMethodsBytes32List);
                    await rates.addSymbol(paymentMethodsBytes32List[0]);
                    await rates.addSymbolWithTokenAddress(paymentMethodsBytes32List[1], paymentToken.address);
                    await rates.set(paymentMethodsBytes32List[0], utils.toInternalUSD(paymentETHPrice));
                    await rates.set(paymentMethodsBytes32List[1], utils.toInternalUSD(paymentTokenPrice));
                    await crowdsale.setup(...params, {from: owner});
                }
            });

            describe('payment with token', () => {
                const paymentAmount = ten.pow(paymentTokenDecimals);

                for(const stageIndex of [0, 1, 2]) {

                    describe(`in stage #${stageIndex}`, () => {
                        let stage;

                        beforeEach(async () => {
                            stage = discountStages[stageIndex];

                            await utils.time.increaseTimeTo(stage.dates[0]);
                        });

                        for (const crowdsaleIndex of [0, 1, 2]) {

                            describe(`in crowdsale #${crowdsaleIndex}`, () => {
                                const ctx = {};

                                let crowdsale;

                                beforeEach(async () => {
                                    crowdsale = crowdsales[crowdsaleIndex];
                                    ctx.invoice = utils.calculatePurchase(
                                        paymentMethods[1],
                                        paymentAmount,
                                        stage.discount,
                                        stage.volumeBoundaries,
                                        stage.volumeBonuses,
                                        utils.toInternalUSD(paymentTokenPrice),
                                        utils.toInternalUSD(crowdsale.args.price),
                                        wtokens[crowdsaleIndex].decimal,
                                        paymentTokenDecimals,
                                        minted[crowdsaleIndex]
                                    );
                                    ctx.fund = crowdsale.fund;
                                    ctx.expectedFee = [
                                        utils.percent(ctx.invoice.tokenAmount, utils.toInternalPercent(serviceFee)),
                                        utils.percent(ctx.invoice.cost, utils.toInternalPercent(saleFee))
                                    ];
                                    ctx.expectedPaymentTokenAmount = ctx.invoice.cost.minus(ctx.expectedFee[1]);
                                    ctx.expectedWTokenAmount = ctx.invoice.tokenAmount;
                                    ctx.WToken = crowdsale.wtoken;
                                    ctx.originToken = crowdsale.originToken;
                                    ctx.PaymentToken = paymentToken;
                                    ctx.contractAddress = crowdsale.crowdsale.address;
                                    ctx.paymentDestinationAddress = crowdsale.fund.address;
                                    ctx.serviceWalletAddress = serviceWallet;
                                    ctx.exchangerAddress = swap;
                                    ctx.investorAddress = buyer;

                                    await ctx.PaymentToken
                                        .approve(
                                            crowdsale.crowdsale.address,
                                            ctx.invoice.cost,
                                            { from: ctx.investorAddress }
                                        );
                                    ctx.Tx = () => crowdsale.crowdsale
                                        .buyTokens(paymentMethodsBytes32List[1], paymentAmount, { from: buyer });
                                });

                                describe('transferring fee', () => {
                                    testFee.defaultProcess(ctx);
                                    testFee.whenPaymentWithToken(ctx);
                                });

                                describe('transferring purchase', () => {
                                    testPurchase.defaultProcess(ctx);
                                    testPurchase.whenPaymentWithToken(ctx);
                                });

                                describe('additionally', () => {
                                    it('call record purchase on the fund', async () => {
                                        await ctx.Tx();

                                        const actual = await ctx.fund._getRecordPurchaseCallResult();
                                        const actualBalance = await ctx.PaymentToken.balanceOf(ctx.fund.address);

                                        actualBalance.should.bignumber.gte(ctx.expectedPaymentTokenAmount);
                                        actual[0].should.to.be.eq(ctx.investorAddress);
                                        actual[1].should.bignumber.eq(ctx.expectedWTokenAmount);
                                        web3.toUtf8(actual[2]).should.to.be.eq(paymentMethods[1]);
                                        actual[3].should.bignumber.eq(ctx.expectedPaymentTokenAmount);
                                        actual[4].should.bignumber.eq(ctx.invoice.costUSD);
                                        actual[5].should.bignumber.eq(0);
                                    });
                                });
                            });
                        }
                    });
                }
            });

            describe('payment with eth', () => {
                const paymentAmount = ten.pow(18); // 1 eth

                for (const stageIndex of [0, 1, 2]) {

                    describe(`in stage #${stageIndex}`, () => {
                        let stage;

                        beforeEach(async () => {
                            stage = discountStages[stageIndex];

                            await utils.time.increaseTimeTo(stage.dates[0]);
                        });

                        for (const crowdsaleIndex of [0, 1, 2]) {

                            describe(`in crowdsale #${crowdsaleIndex}`, () => {
                                const ctx = {};

                                let crowdsale;

                                beforeEach(async () => {
                                    crowdsale = crowdsales[crowdsaleIndex];
                                    ctx.invoice = utils.calculatePurchase(
                                        paymentMethods[0],
                                        paymentAmount,
                                        stage.discount,
                                        stage.volumeBoundaries,
                                        stage.volumeBonuses,
                                        utils.toInternalUSD(paymentETHPrice),
                                        utils.toInternalUSD(crowdsale.args.price),
                                        wtokens[crowdsaleIndex].decimal,
                                        18,
                                        minted[crowdsaleIndex]
                                    );
                                    ctx.fund = crowdsale.fund;
                                    ctx.expectedFee = [
                                        utils.percent(ctx.invoice.tokenAmount, utils.toInternalPercent(serviceFee)),
                                        utils.percent(ctx.invoice.cost, utils.toInternalPercent(saleFee))
                                    ];
                                    ctx.expectedPaymentETHAmount = ctx.invoice.cost.minus(ctx.expectedFee[1]);
                                    ctx.expectedWTokenAmount = ctx.invoice.tokenAmount;
                                    ctx.WToken = crowdsale.wtoken;
                                    ctx.originToken = crowdsale.originToken;
                                    ctx.contractAddress = crowdsale.crowdsale.address;
                                    ctx.paymentDestinationAddress = crowdsale.fund.address;
                                    ctx.serviceWalletAddress = serviceWallet;
                                    ctx.exchangerAddress = swap;
                                    ctx.investorAddress = buyer;

                                    ctx.Tx = () => crowdsale.crowdsale
                                        .buyTokens(paymentMethodsBytes32List[0], paymentAmount, {from: buyer, value: paymentAmount});
                                });

                                afterEach(async () => {
                                    await crowdsale.fund._outEther(buyer);
                                });

                                describe('transferring fee', () => {
                                    testFee.defaultProcess(ctx);
                                    testFee.whenPaymentWithETH(ctx);
                                });

                                describe('transferring purchase', () => {
                                    testPurchase.defaultProcess(ctx);
                                    testPurchase.whenPaymentWithETH(ctx);
                                });

                                describe('additionally', () => {
                                    it('call record purchase on the fund', async () => {
                                        await ctx.Tx();

                                        const actual = await ctx.fund._getRecordPurchaseCallResult();
                                        const actualBalance = await web3.eth.getBalance(ctx.fund.address);

                                        actualBalance.should.bignumber.gte(ctx.expectedPaymentETHAmount);
                                        actual[0].should.to.be.eq(ctx.investorAddress);
                                        actual[1].should.bignumber.eq(ctx.expectedWTokenAmount);
                                        web3.toUtf8(actual[2]).should.to.be.eq(paymentMethods[0]);
                                        actual[3].should.bignumber.eq(ctx.expectedPaymentETHAmount);
                                        actual[4].should.bignumber.eq(ctx.invoice.costUSD);
                                        actual[5].should.bignumber.eq(ctx.expectedPaymentETHAmount);
                                    });
                                });
                            });
                        }
                    });
                }
            });

            it('should not sell some tokens if sale is not active', async () => {
                const someStage1 = discountStages[1];
                const someStage2 = discountStages[2];
                const someDate = someStage1.dates[1] + Math.floor((someStage2.dates[0] - someStage1.dates[1]) / 2);

                await utils.time.increaseTimeTo(someDate);

                await firstCrowdsale.buyTokens(paymentMethodsBytes32List[0], ten.pow(18), {value: ten.pow(18), from: buyer})
                    .should.be.rejectedWith(utils.EVMRevert);
            });
        });

        describe('unsold tokens', async () => {
            let discountStages;

            beforeEach(async () => {
                discountStages = defaultStagesGenerator([
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ]
                    },
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(70),
                            startDate + utils.time.duration.minutes(90),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(210),
                        discount: utils.toInternalPercent(5),
                        volumeBoundaries: [utils.toInternalUSD(1)],
                        volumeBonuses: [utils.toInternalPercent(13)],
                    },
                    {
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: utils.toInternalPercent(10),
                        volumeBoundaries: [utils.toInternalUSD(1)],
                        volumeBonuses: [utils.toInternalPercent(23)],
                    }
                ]);

                const params = utils.packSetupCrowdsaleParameters(discountStages, milestonesDefaultFixture(startDate), paymentMethodsBytes32List);

                await firstCrowdsaleRates.addSymbol(paymentMethodsBytes32List[0]);
                await firstCrowdsaleRates.addSymbolWithTokenAddress(paymentMethodsBytes32List[1], utils.generateRandomAddress());
                await firstCrowdsale.setup(...params, {from: owner});

                endDate = discountStages[2].dates[1];
            });

            it('shouldn\'t return unsold tokens before the end', async () => {
                (await firstCrowdsale.isEnded()).should.be.equal(false);

                await firstCrowdsale.claimRemainingTokens({from: owner})
                    .should.be.rejectedWith(utils.EVMRevert);
            });

            describe('return unsold tokens after the end', async () => {
                let txReceipt;
                let logs;
                let crowdsaleBalanceBefore;
                let ownerBalanceBefore;

                beforeEach(async () => {
                    await utils.time.increaseTimeTo(endDate + 10);

                    crowdsaleBalanceBefore = await firstCrowdsaleWToken.balanceOf(firstCrowdsale.address);
                    ownerBalanceBefore = await firstCrowdsaleWToken.balanceOf(owner);

                    txReceipt = await firstCrowdsale.claimRemainingTokens({from: owner})
                        .should.be.fulfilled;

                    logs = txReceipt.logs;
                });

                it('should return', async () => {
                    const crowdsaleBalanceAfter = await firstCrowdsaleWToken.balanceOf(firstCrowdsale.address);
                    const ownerBalanceAfter = await firstCrowdsaleWToken.balanceOf(owner);

                    crowdsaleBalanceAfter.should.bignumber.equal(0);
                    ownerBalanceAfter.should.bignumber.equal(crowdsaleBalanceBefore.plus(ownerBalanceBefore));
                });

                it('should emit on return', async () => {
                    const event = await utils.expectEvent.inLogs(logs, 'UnsoldTokenReturned');

                    event.args.owner.should.eq(owner);
                    event.args.amount.should.be.bignumber.equal(crowdsaleBalanceBefore);
                });
            });
        });
    });
});
