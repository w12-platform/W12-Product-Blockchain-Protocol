require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const Token = artifacts.require('WToken');
const oneToken = new BigNumber(10).pow(18);
const helpers = require('./fixtures/W12Crowdsale');
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
    const swap = accounts[7];
    const serviceWallet = accounts[6];
    const owner = accounts[0];
    const price = 100;
    const serviceFee = 10;
    const tranchePercent = 5;
    const saleFee = 10;
    const mint = oneToken.mul(oneToken);

    let originTokens = [];
    let wtokens = [];
    let crowdsales = [];

    let startDate;
    let endDate;

    beforeEach(async () => {
        startDate = web3.eth.getBlock('latest').timestamp + 60;
        wtokens = await helpers.generateWTokens([0, 18, 255], owner);
        originTokens = await helpers.generateWTokens([0, 18, 255], owner);
        crowdsales = await helpers.generateW12CrowdsaleStubWithDifferentToken(
            {
                serviceWallet,
                swap,
                price,
                tranchePercent,
                serviceFee,
                saleFee,
                mint
            }, originTokens, wtokens, owner
        );
    });

    describe('constructor', async () => {
        it('should create crowdsale', async () => {
            const sut = crowdsales[0].crowdsale;
            const wtoken = wtokens[0].token;
            const originToken = originTokens[0].token;

            (await sut.token()).should.be.equal(wtoken.address);
            (await sut.originToken()).should.be.equal(originToken.address);
            (await sut.price()).should.bignumber.equal(price);
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

            it('must check that the function returns the correct Milestone index for each date in the given array', async () => {
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

    describe('token purchase', async () => {
        const buyer = accounts[8];
        const notBuyer = accounts[7];
        let firstCrowdsale;
        let firstCrowdsaleFund;
        let firstCrowdsaleRates;
        let firstCrowdsaleWToken;
        let firstCrowdsaleOriginToken;
        let discountStages;
        let oneWToken;
        let oneOriginToken;

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
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: utils.toInternalPercent(10)
                    }
                ]);

                for (const item of crowdsales) {
                    const { crowdsale } = item;
                    const params = utils.packSetupCrowdsaleParameters(discountStages, milestonesDefaultFixture(startDate));
                    await crowdsale.setup(...params, {from: owner});
                }
                endDate = discountStages[2].dates[1];
            });

            it('should not sell some tokens if sale is not active', async () => {
                const someStage1 = discountStages[1];
                const someStage2 = discountStages[2];
                const someDate = someStage1.dates[1] + Math.floor((someStage2.dates[0] - someStage1.dates[1]) / 2);

                await utils.time.increaseTimeTo(someDate);

                await firstCrowdsale.buyTokens({value: 1000000, from: buyer})
                    .should.be.rejectedWith(utils.EVMRevert);
            });

            it('should sell tokens from each stage', async () => {
                for (const stage of discountStages) {
                    const balanceBefore = await firstCrowdsaleWToken.balanceOf(buyer);

                    await utils.time.increaseTimeTo(stage.dates[1] - 30);

                    await firstCrowdsale.buyTokens({value: oneToken, from: buyer}).should.be.fulfilled;

                    const balanceAfter = await firstCrowdsaleWToken.balanceOf(buyer);
                    const expected = utils.calculatePurchase(
                        oneToken,
                        price,
                        stage.discount,
                        BigNumber.Zero,
                        await firstCrowdsaleWToken.decimals()
                    );

                    balanceAfter.minus(balanceBefore)
                        .should.bignumber.equal(expected);
                }
            });

            describe('unsold tokens', async () => {
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

                it('shouldn\'t return unsold tokens before the end', async () => {
                    (await firstCrowdsale.isEnded()).should.be.equal(false);
                    await firstCrowdsale.claimRemainingTokens({from: owner}).should.be.rejectedWith(utils.EVMRevert);
                });
            });
        });
    });
});
