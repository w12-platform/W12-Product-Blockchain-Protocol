require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const oneToken = new BigNumber(10).pow(18);
const helpers = require('./fixtures/W12Crowdsale');

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

    describe('stages and milestones', async () => {
        let sut;

        beforeEach(async () => {
            sut = crowdsales[0].crowdsale;
        });

        it('should set stages', async () => {
            const discountStages = [
                {
                    name: 'Phase 0',
                    dates: [
                        startDate + utils.time.duration.minutes(40),
                        startDate + utils.time.duration.minutes(60),
                    ],
                    vestingTime: 0,
                    discount: utils.toInternalPercent(0)
                }
            ];
            const endDate = discountStages[discountStages.length - 1].dates[1];

            await sut.setStages(
                discountStages.map(s => s.dates),
                discountStages.map(s => s.discount),
                discountStages.map(s => s.vestingTime),
                {from: owner}
            ).should.be.fulfilled;

            const actualNumberOfStages = await sut.stagesLength().should.be.fulfilled;
            const actualEndDate = await sut.getEndDate().should.be.fulfilled;

            actualNumberOfStages.should.bignumber.equal(discountStages.length);
            actualEndDate.should.bignumber.equal(endDate);

            for (let i = 0; i < discountStages.length; i++) {
                const expectedStage = discountStages[i];
                const actualStage = await sut.stages(i).should.be.fulfilled;

                actualStage[0].should.bignumber.equal(expectedStage.dates[0]);
                actualStage[1].should.bignumber.equal(expectedStage.dates[1]);
                actualStage[2].should.bignumber.equal(expectedStage.discount);
                actualStage[3].should.bignumber.equal(expectedStage.vestingTime);
            }
        });

        it('should revert if stages is not in ascending order', async () => {
            const discountStages = [
                {
                    name: 'Phase 5',
                    dates: [
                        startDate + utils.time.duration.minutes(70),
                        startDate + utils.time.duration.minutes(90),
                    ],
                    vestingTime: startDate + utils.time.duration.minutes(210),
                    discount: 5
                },
                {
                    name: 'Phase 0',
                    dates: [
                        startDate + utils.time.duration.minutes(40),
                        startDate + utils.time.duration.minutes(60),
                    ],
                    vestingTime: 0,
                    discount: 0
                }
            ];

            await sut.setStages(
                discountStages.map(s => s.dates),
                discountStages.map(s => s.discount),
                discountStages.map(s => s.vestingTime),
                {from: owner}
            ).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should accept single milestone', async () => {
            const expectedMilestones = [{
                name: "Single milestone",
                description: "Single milestone with 100% tranche",
                endDate: startDate + 30,
                voteEndDate: startDate + 60,
                withdrawalWindow: startDate + 120,
                tranchePercent: utils.toInternalPercent(100)
            }];

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

            await sut.setMilestones(
                encodedMilestones.reduce((result, item) => result.concat(item.dates), []),
                encodedMilestones.map(m => m.tranchePercent),
                encodedMilestones.reduce((result, item) => result.concat(item.offsets), []),
                encodedMilestones.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
                {from: owner}
            ).should.be.fulfilled;

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

        it('should set milestones', async () => {
            const expectedMilestones = [
                {
                    name: "Milestone 1",
                    description: "Milestone 1",
                    endDate: startDate + 30,
                    voteEndDate: startDate + 60,
                    withdrawalWindow: startDate + 120,
                    tranchePercent: utils.toInternalPercent(50)
                },
                {
                    name: "Milestone 2",
                    description: "Milestone 2",
                    endDate: startDate + 125,
                    voteEndDate: startDate + 126,
                    withdrawalWindow: startDate + 127,
                    tranchePercent: utils.toInternalPercent(50)
                }
            ];

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

            await sut.setMilestones(
                encodedMilestones.reduce((result, item) => result.concat(item.dates), []),
                encodedMilestones.map(m => m.tranchePercent),
                encodedMilestones.reduce((result, item) => result.concat(item.offsets), []),
                encodedMilestones.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
                {from: owner}
            ).should.be.fulfilled;

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
            const encodedMilestones = [
                {
                    name: "Milestone 2",
                    description: "Milestone 2",
                    endDate: startDate + 125,
                    tranchePercent: 10,
                    voteEndDate: startDate + 126,
                    withdrawalWindow: startDate + 127,
                    tranchePercent: utils.toInternalPercent(50)
                },
                {
                    name: "Milestone 1",
                    description: "Milestone 1",
                    endDate: startDate,
                    voteEndDate: startDate + 60,
                    withdrawalWindow: startDate + 120,
                    tranchePercent: utils.toInternalPercent(50)
                }
            ].map(item => {
                return utils.encodeMilestoneParameters(
                    item.name,
                    item.description,
                    item.tranchePercent,
                    item.endDate,
                    item.voteEndDate,
                    item.withdrawalWindow
                );
            });

            await sut.setMilestones(
                encodedMilestones.reduce((result, item) => result.concat(item.dates), []),
                encodedMilestones.map(m => m.tranchePercent),
                encodedMilestones.reduce((result, item) => result.concat(item.offsets), []),
                encodedMilestones.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
                {from: owner}
            ).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should revert set stages if last stage end date after first milestone end date', async () => {
            const milestones = [{
                name: "Single milestone",
                description: "Single milestone with 100% tranche",
                endDate: startDate + 120,
                tranchePercent: 10,
                voteEndDate: startDate + 121,
                withdrawalWindow: startDate + 122,
                tranchePercent: utils.toInternalPercent(100)
            }];

            const discountStages = [
                {
                    name: 'Phase 0',
                    dates: [
                        startDate + 120,
                        startDate + 121,
                    ],
                    vestingTime: 0,
                    discount: utils.toInternalPercent(0)
                }
            ];

            const encodedMilestones = milestones.map(item => {
                return utils.encodeMilestoneParameters(
                    item.name,
                    item.description,
                    item.tranchePercent,
                    item.endDate,
                    item.voteEndDate,
                    item.withdrawalWindow
                );
            });

            await sut.setMilestones(
                encodedMilestones.reduce((result, item) => result.concat(item.dates), []),
                encodedMilestones.map(m => m.tranchePercent),
                encodedMilestones.reduce((result, item) => result.concat(item.offsets), []),
                encodedMilestones.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
                {from: owner}
            ).should.be.fulfilled;

            await sut.setStages(
                discountStages.map(s => s.dates),
                discountStages.map(s => s.discount),
                discountStages.map(s => s.vestingTime),
                {from: owner}
            ).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should revert set milestones if first milestone end date before last stage end date', async () => {
            const milestones = [{
                name: "Single milestone",
                description: "Single milestone with 100% tranche",
                endDate: startDate + 120,
                tranchePercent: 10,
                voteEndDate: startDate + 121,
                withdrawalWindow: startDate + 122,
                tranchePercent: utils.toInternalPercent(100)
            }];

            const discountStages = [
                {
                    name: 'Phase 0',
                    dates: [
                        startDate + 120,
                        startDate + 121,
                    ],
                    vestingTime: 0,
                    discount: utils.toInternalPercent(0)
                }
            ];

            const encodedMilestones = milestones.map(item => {
                return utils.encodeMilestoneParameters(
                    item.name,
                    item.description,
                    item.tranchePercent,
                    item.endDate,
                    item.voteEndDate,
                    item.withdrawalWindow
                );
            });

            await sut.setStages(
                discountStages.map(s => s.dates),
                discountStages.map(s => s.discount),
                discountStages.map(s => s.vestingTime),
                {from: owner}
            ).should.be.fulfilled;

            await sut.setMilestones(
                encodedMilestones.reduce((result, item) => result.concat(item.dates), []),
                encodedMilestones.map(m => m.tranchePercent),
                encodedMilestones.reduce((result, item) => result.concat(item.offsets), []),
                encodedMilestones.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
                {from: owner}
            ).should.be.rejectedWith(utils.EVMRevert);
        });

        describe('stages', async () => {
            let discountStages;

            beforeEach(async () => {
                discountStages = [
                    {
                        name: 'Phase 0',
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ],
                        vestingTime: 0,
                        discount: utils.toInternalPercent(0)
                    },
                    {
                        name: 'Phase 5',
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
                ];

                await sut.setStages(
                    discountStages.map(s => s.dates),
                    discountStages.map(s => s.discount),
                    discountStages.map(s => s.vestingTime),
                    {from: owner}
                );
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
                const edges = [
                    oneToken,
                    oneToken.mul(2),
                    oneToken.mul(10)
                ];
                const bonuses = [
                    utils.toInternalPercent(1),
                    utils.toInternalPercent(2),
                    utils.toInternalPercent(3)
                ];
                await sut.setStageVolumeBonuses(0, edges, bonuses, {from: owner})
                    .should.be.fulfilled;

                const actualVolumeBoundaries = await sut.getStageVolumeBoundaries(0)
                    .should.be.fulfilled;
                const actualVolumeBonuses = await sut.getStageVolumeBonuses(0)
                    .should.be.fulfilled;

                for(const index in edges) {
                    actualVolumeBoundaries[index].should.be.bignumber.eq(edges[index]);
                    actualVolumeBonuses[index].should.be.bignumber.eq(bonuses[index]);
                }
            });

            it('should not set stage bonuses if volume boundaries is not in ascending order', async () => {
                const edges = [
                    oneToken.mul(2),
                    oneToken,
                    oneToken.mul(10)
                ];
                const bonuses = [
                    utils.toInternalPercent(1),
                    utils.toInternalPercent(2),
                    utils.toInternalPercent(3)
                ];
                await sut.setStageVolumeBonuses(0, edges, bonuses, {from: owner})
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
                expectedMilestones = [
                    {
                        name: "Milestone 1 name",
                        description: "Milestone 2 description",
                        endDate: startDate + utils.time.duration.days(10),
                        tranchePercent: utils.toInternalPercent(30),
                        voteEndDate: startDate + utils.time.duration.days(17),
                        withdrawalWindow: startDate + utils.time.duration.days(20)
                    },
                    {
                        name: "Milestone 2 name",
                        description: "Milestone 2 description",
                        endDate: startDate + utils.time.duration.days(21),
                        tranchePercent: utils.toInternalPercent(35),
                        voteEndDate: startDate + utils.time.duration.days(27),
                        withdrawalWindow: startDate + utils.time.duration.days(30)
                    },
                    {
                        name: "Milestone 3 name",
                        description: "Milestone 3 description",
                        endDate: startDate + utils.time.duration.days(31),
                        tranchePercent: utils.toInternalPercent(35),
                        voteEndDate: startDate + utils.time.duration.days(37),
                        withdrawalWindow: startDate + utils.time.duration.days(40)
                    }
                ];

                discountStages = [
                    {
                        name: 'Phase 0',
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ],
                        vestingTime: 0,
                        discount: utils.toInternalPercent(0)
                    },
                    {
                        name: 'Phase 5',
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
                ];

                await sut.setStages(
                    discountStages.map(s => s.dates),
                    discountStages.map(s => s.discount),
                    discountStages.map(s => s.vestingTime),
                    {from: owner}
                );

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

                await sut.setMilestones(
                    encodedMilestones.reduce((result, item) => result.concat(item.dates), []),
                    encodedMilestones.map(m => m.tranchePercent),
                    encodedMilestones.reduce((result, item) => result.concat(item.offsets), []),
                    encodedMilestones.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
                    {from: owner}
                ).should.be.fulfilled;
            });

            it('should`t return current milestone index', async () => {
                await utils.time.increaseTimeTo(discountStages[discountStages.length - 1].endDate);

                const result = await sut.getCurrentMilestoneIndex()
                    .should.be.fulfilled;

                result[0].should.bignumber.equal(0);
                result[1].should.be.equal(false);
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

            it('should return last milestone index in case when current date gt last milestone', async () => {
                await utils.time.increaseTimeTo(expectedMilestones[expectedMilestones.length - 1].endDate + utils.time.duration.minutes(1));

                const result = await sut.getCurrentMilestoneIndex()
                    .should.be.fulfilled

                result[0].should.bignumber.equal(expectedMilestones.length - 1);
                result[1].should.be.equal(true);
            });
        });
    });

    describe('token purchase', async () => {
        const buyer = accounts[8];
        const notBuyer = accounts[7];
        let firstCrowdsale;
        let firstCrowdsaleFund;
        let firstCrowdsaleWToken;
        let firstCrowdsaleOriginToken;
        let discountStages;
        let oneWToken;
        let oneOriginToken;

        beforeEach(async () => {
            firstCrowdsale = crowdsales[0].crowdsale;
            firstCrowdsaleFund = crowdsales[0].fund;
            firstCrowdsaleWToken = crowdsales[0].wtoken;
            firstCrowdsaleOriginToken = crowdsales[0].originToken;
            oneWToken = new BigNumber(10).pow(await firstCrowdsaleWToken.decimals());
            oneOriginToken = new BigNumber(10).pow(await firstCrowdsaleOriginToken.decimals());
        });

        describe('with discounts stages', async () => {

            beforeEach(async () => {
                discountStages = [
                    {
                        name: 'Phase 0',
                        dates: [
                            startDate + utils.time.duration.minutes(40),
                            startDate + utils.time.duration.minutes(60),
                        ],
                        vestingTime: 0,
                        discount: utils.toInternalPercent(0)
                    },
                    {
                        name: 'Phase 5',
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
                ];

                for (const item of crowdsales) {
                    const { crowdsale } = item;
                    await crowdsale.setStages(
                        discountStages.map(s => s.dates),
                        discountStages.map(s => s.discount),
                        discountStages.map(s => s.vestingTime),
                        {from: owner}
                    );
                }
                endDate = discountStages[2].dates[1];
            });

            describe('should successful sell token on each crowdsale', async () => {
                let stage;
                const buyAmount = 10;
                const buyPrice = buyAmount * price;

                beforeEach(async () => {
                    stage = discountStages[0];

                    await utils.time.increaseTimeTo(stage.dates[0] + 10);
                });

                let counter = 0;
                for (const {crowdsale} of crowdsales) {
                    it(`crowdsale#${counter}`, async () => {
                        await crowdsale.buyTokens({ value: buyPrice, from: buyer })
                            .should.be.fulfilled;
                    });
                }
            });

            describe('purchase steps', async () => {
                const buyAmount = 10;
                const saleFeeAmount = buyAmount * (saleFee / 100);
                const buyPrice = buyAmount * price;
                const serviceFeeAmount = buyPrice * (serviceFee / 100);

                let stage;
                let crowdsale;
                let crowdsaleFund;
                let wtoken;
                let originToken;
                let oneWToken;
                let oneOriginToken;

                beforeEach(async () => {
                    stage = discountStages[0];
                    crowdsale = crowdsales[0].crowdsale;
                    crowdsaleFund = crowdsales[0].fund;
                    wtoken = crowdsales[0].wtoken;
                    originToken = crowdsales[0].originToken;
                    oneWToken = new BigNumber(10).pow(await wtoken.decimals());
                    oneOriginToken = new BigNumber(10).pow(await originToken.decimals());

                    await utils.time.increaseTimeTo(stage.dates[0] + 10);
                });

                it('should fill buyer balance', async () => {
                    const before = await wtoken.balanceOf(buyer);
                    const expected = before.plus(oneWToken.mul(buyAmount));

                    await crowdsale.buyTokens({ value: buyPrice, from: buyer });

                    (await wtoken.balanceOf(buyer))
                        .should.bignumber.equal(expected);
                });

                it('should send sale fee to service wallet', async () => {
                    const before = await originToken.balanceOf(serviceWallet);
                    const expected = before.plus(oneOriginToken.mul(saleFeeAmount));

                    await crowdsale.buyTokens({value: buyPrice, from: buyer});

                    (await originToken.balanceOf(serviceWallet))
                        .should.bignumber.equal(expected);
                });

                it('should spend sale fee from swap', async () => {
                    const before = await originToken.balanceOf(swap);
                    const expected = before.minus(oneOriginToken.mul(saleFeeAmount));

                    await crowdsale.buyTokens({value: buyPrice, from: buyer});

                    (await originToken.balanceOf(swap))
                        .should.bignumber.equal(expected);
                });

                it('should send wtokens from crowdsale address', async () => {
                    const before = await wtoken.balanceOf(crowdsale.address);
                    const expected = before
                        // commission
                        .minus(oneWToken.mul(saleFeeAmount))
                        // purchase amount
                        .minus(oneWToken.mul(buyAmount))

                    await crowdsale.buyTokens({value: buyPrice, from: buyer});

                    (await wtoken.balanceOf(crowdsale.address))
                        .should.bignumber.equal(expected);
                });

                it('should send fee to swap', async () => {
                    const before = await wtoken.balanceOf(swap);
                    const expected = before.plus(oneWToken.mul(saleFeeAmount));

                    await crowdsale.buyTokens({value: buyPrice, from: buyer});

                    (await wtoken.balanceOf(swap))
                        .should.bignumber.equal(expected);
                });

                it('should fill fund', async () => {
                    const before = await web3.eth.getBalance(crowdsaleFund.address);
                    const expected = before
                        .plus(buyPrice)
                        .minus(serviceFeeAmount);

                    await crowdsale.buyTokens({value: buyPrice, from: buyer});

                    (await web3.eth.getBalance(crowdsaleFund.address))
                        .should.bignumber.equal(expected);
                });

                it('should send fee in wei to service wallet', async () => {
                    const before = await web3.eth.getBalance(serviceWallet);
                    const expected = before
                        .plus(serviceFeeAmount);

                    await crowdsale.buyTokens({value: buyPrice, from: buyer});

                    (await web3.eth.getBalance(serviceWallet))
                        .should.bignumber.equal(expected);
                });
            });

            it('should return change', async () => {
                const stage = discountStages[0];
                const buyTokenAmount = 200;
                const buyValueWei = new BigNumber(price * buyTokenAmount);
                const expectedChange = buyValueWei.div(2);
                const expectedWBalance = oneWToken.mul(100);
                const buyerBalanceBefore = await web3.eth.getBalance(buyer);

                await utils.time.increaseTimeTo(stage.dates[0] + 10);

                await firstCrowdsale._outTokens(
                    notBuyer,
                    new BigNumber(mint).minus(expectedWBalance),
                    {from: owner}
                )
                    .should.be.fulfilled;

                await firstCrowdsale._setState(0, {from: owner})
                    .should.be.fulfilled;

                const receipt = await firstCrowdsale.buyTokens({value: buyValueWei, from: buyer}).should.be.fulfilled;
                const cost = await utils.getTransactionCost(receipt);
                const expectedBalance = buyerBalanceBefore
                    .minus(cost)
                    .minus(buyValueWei)
                    .plus(expectedChange);

                (await firstCrowdsaleWToken.balanceOf(buyer))
                    .should.bignumber.equal(expectedWBalance);

                (await web3.eth.getBalance(buyer))
                    .should.bignumber.equal(expectedBalance);
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

        describe('volume bonuses', async () => {
            const expected = [
                // boundary, bonus, testWei
                [new BigNumber(0), new BigNumber(utils.toInternalPercent(0)), new BigNumber(10000)], // no bonus

                [new BigNumber(10000000), new BigNumber(utils.toInternalPercent(5)), new BigNumber(10000000)],
                [new BigNumber(100000000), new BigNumber(utils.toInternalPercent(10)), new BigNumber(100000001)]
            ];
            let stage;

            beforeEach(async () => {
                stage = {
                    name: 'Phase 0',
                    dates: [
                        startDate + utils.time.duration.minutes(80),
                        startDate + utils.time.duration.minutes(90)
                    ],
                    vestingTime: 0,
                    discount: utils.toInternalPercent(0),
                    volumeBonuses: expected.slice(1).map(item => ({
                        boundary: item[0],
                        bonus: item[1],
                    }))
                };
                const stages = [stage];

                await firstCrowdsale.setStages(
                    stages.map(s => s.dates),
                    stages.map(s => s.discount),
                    stages.map(s => s.vestingTime),
                    {from: owner}
                ).should.be.fulfilled;

                await firstCrowdsale.setStageVolumeBonuses(0,
                    stages[0].volumeBonuses.map(vb => vb.boundary),
                    stages[0].volumeBonuses.map(vb => vb.bonus),
                    {from: owner}
                ).should.be.fulfilled;

                await utils.time.increaseTimeTo(stage.dates[0]);
            });

            for (const itemIdx in expected) {
                const item = expected[+itemIdx];
                const volume = item[0];
                const percent = item[1];
                const wei = item[2];

                const nextVolume = +itemIdx != (expected.length - 1) ? expected[+itemIdx + 1][0] : 'Infinity';

                it(`should sell tokens for volume in [${volume.toString()}, ${nextVolume.toString()}) with bonus ${utils.fromInternalPercent(percent.toNumber())}%`, async () => {
                    const tokens = utils.calculatePurchase(
                        wei
                        , price
                        , BigNumber.Zero
                        , percent
                        , await firstCrowdsaleWToken.decimals()
                    );

                    await firstCrowdsale.buyTokens({ value: wei, from: buyer })
                        .should.be.fulfilled;

                    (await firstCrowdsaleWToken.balanceOf(buyer))
                        .should.bignumber.equal(tokens);
                });
            }
        });
    });
});
