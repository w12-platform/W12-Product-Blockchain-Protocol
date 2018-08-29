require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const W12Fund = artifacts.require('W12Fund');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const WToken = artifacts.require('WToken');
const oneToken = new BigNumber(10).pow(18);

contract('W12Crowdsale', async (accounts) => {
    let sut;
    let originToken;
    let token;
    const tokenOwner = accounts[9];
    let startDate;
    let endDate;
    let price;
    const serviceWallet = accounts[6];
    const swap = accounts[7];
    let fund;

    beforeEach(async () => {
        originToken = await WToken.new('TestToken', 'TT', 18, {from: tokenOwner}).should.be.fulfilled;
        token = await WToken.new('TestToken', 'TT', 18, {from: tokenOwner}).should.be.fulfilled;
        fund = await W12Fund.new(5 * 100, {from: tokenOwner}).should.be.fulfilled;
        startDate = web3.eth.getBlock('latest').timestamp + 60;

        sut = await W12CrowdsaleStub.new(
            originToken.address,
            token.address,
            18,
            100,
            serviceWallet,
            swap,
            10 * 100,
            10 * 100,
            fund.address,
            {from: tokenOwner}
        ).should.be.fulfilled;

        await token.addTrustedAccount(sut.address, {from: tokenOwner}).should.be.fulfilled;
        await token.mint(sut.address, oneToken.mul(oneToken), 0, {from: tokenOwner}).should.be.fulfilled;
        await originToken.mint(swap, oneToken.mul(oneToken), 0, {from: tokenOwner}).should.be.fulfilled;
        await originToken.approve(sut.address, oneToken.mul(oneToken).mul(0.1), {from: swap}).should.be.fulfilled;
        await fund.setCrowdsale(sut.address, {from: tokenOwner}).should.be.fulfilled;

        price = await sut.price();
    });

    describe('constructor', async () => {
        it('should create crowdsale', async () => {
            (await sut.token()).should.be.equal(token.address);
            (await sut.originToken()).should.be.equal(originToken.address);
            (await sut.price()).should.bignumber.equal(100);
            (await sut.serviceFee()).should.bignumber.equal(10 * 100);
            (await sut.WTokenSaleFeePercent()).should.bignumber.equal(10 * 100);
            (await sut.serviceWallet()).should.be.equal(serviceWallet);
            (await sut.swap()).should.be.equal(swap);
        });
    });

    describe('stages and milestones', async () => {

        it('should set stages', async () => {
            const discountStages = [
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
            const endDate = discountStages[discountStages.length - 1].dates[1];

            await sut.setStages(
                discountStages.map(s => s.dates),
                discountStages.map(s => s.discount),
                discountStages.map(s => s.vestingTime),
                {from: tokenOwner}
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
                {from: tokenOwner}
            ).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should accept single milestone', async () => {
            const expectedMilestones = [{
                name: "Single milestone",
                description: "Single milestone with 100% tranche",
                endDate: startDate + 30,
                voteEndDate: startDate + 60,
                withdrawalWindow: startDate + 120,
                tranchePercent: 100
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
                {from: tokenOwner}
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
                    tranchePercent: 50
                },
                {
                    name: "Milestone 2",
                    description: "Milestone 2",
                    endDate: startDate + 125,
                    voteEndDate: startDate + 126,
                    withdrawalWindow: startDate + 127,
                    tranchePercent: 50
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
                {from: tokenOwner}
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
                    tranchePercent: 50
                },
                {
                    name: "Milestone 1",
                    description: "Milestone 1",
                    endDate: startDate,
                    voteEndDate: startDate + 60,
                    withdrawalWindow: startDate + 120,
                    tranchePercent: 50
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
                {from: tokenOwner}
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
                tranchePercent: 100
            }];

            const discountStages = [
                {
                    name: 'Phase 0',
                    dates: [
                        startDate + 120,
                        startDate + 121,
                    ],
                    vestingTime: 0,
                    discount: 0
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
                {from: tokenOwner}
            ).should.be.fulfilled;

            await sut.setStages(
                discountStages.map(s => s.dates),
                discountStages.map(s => s.discount),
                discountStages.map(s => s.vestingTime),
                {from: tokenOwner}
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
                tranchePercent: 100
            }];

            const discountStages = [
                {
                    name: 'Phase 0',
                    dates: [
                        startDate + 120,
                        startDate + 121,
                    ],
                    vestingTime: 0,
                    discount: 0
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
                {from: tokenOwner}
            ).should.be.fulfilled;

            await sut.setMilestones(
                encodedMilestones.reduce((result, item) => result.concat(item.dates), []),
                encodedMilestones.map(m => m.tranchePercent),
                encodedMilestones.reduce((result, item) => result.concat(item.offsets), []),
                encodedMilestones.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
                {from: tokenOwner}
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
                        discount: 0
                    },
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
                        name: 'Phase 10',
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: 10
                    }
                ];

                await sut.setStages(
                    discountStages.map(s => s.dates),
                    discountStages.map(s => s.discount),
                    discountStages.map(s => s.vestingTime),
                    {from: tokenOwner}
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
                await sut.setStageVolumeBonuses(0,
                    [oneToken, oneToken.mul(2), oneToken.mul(10)],
                    [1, 2, 10],
                    {from: tokenOwner}).should.be.fulfilled;

                const actualVolumeBoundaries = (await sut.getStageVolumeBoundaries(0).should.be.fulfilled).map(x => x.toNumber());
                const actualVolumeBonuses = (await sut.getStageVolumeBonuses(0).should.be.fulfilled).map(x => x.toNumber());

                actualVolumeBoundaries.should.be.equalTo([oneToken.toNumber(), oneToken.mul(2).toNumber(), oneToken.mul(10).toNumber()]);
                actualVolumeBonuses.should.be.equalTo([1, 2, 10]);
            });

            it('should not set stage bonuses if volume boundaries is not in ascending order', async () => {
                await sut.setStageVolumeBonuses(0,
                    [oneToken.mul(10), oneToken.mul(2), oneToken],
                    [1, 2, 10],
                    {from: tokenOwner}
                ).should.be.rejectedWith(utils.EVMRevert);
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
                        tranchePercent: 30,
                        voteEndDate: startDate + utils.time.duration.days(17),
                        withdrawalWindow: startDate + utils.time.duration.days(20)
                    },
                    {
                        name: "Milestone 2 name",
                        description: "Milestone 2 description",
                        endDate: startDate + utils.time.duration.days(20) + 1,
                        tranchePercent: 35,
                        voteEndDate: startDate + utils.time.duration.days(27),
                        withdrawalWindow: startDate + utils.time.duration.days(30)
                    },
                    {
                        name: "Milestone 3 name",
                        description: "Milestone 3 description",
                        endDate: startDate + utils.time.duration.days(30) + 1,
                        tranchePercent: 35,
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
                        discount: 0
                    },
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
                        name: 'Phase 10',
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: 10
                    }
                ];

                await sut.setStages(
                    discountStages.map(s => s.dates),
                    discountStages.map(s => s.discount),
                    discountStages.map(s => s.vestingTime),
                    {from: tokenOwner}
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
                    {from: tokenOwner}
                ).should.be.fulfilled;
            });

            it('should return current milestone index', async () => {
                await utils.time.increaseTimeTo(discountStages[discountStages.length - 1].endDate - utils.time.duration.minutes(1));
                (await sut.getCurrentMilestoneIndex().should.be.fulfilled).should.bignumber.equal(0);

                let expectedIndex = 0;
                for (const milestone of expectedMilestones) {
                    await utils.time.increaseTimeTo(milestone.endDate - utils.time.duration.minutes(10));

                    const actualIndex = await sut.getCurrentMilestoneIndex().should.be.fulfilled;

                    actualIndex.should.bignumber.equal(expectedIndex);

                    expectedIndex++;
                }

                await utils.time.increaseTimeTo(expectedMilestones[expectedMilestones.length - 1].endDate + utils.time.duration.minutes(1));
                (await sut.getCurrentMilestoneIndex().should.be.fulfilled).should.bignumber.equal(expectedMilestones.length - 1);
            });
        });
    });

    describe('token purchase', async () => {
        let discountStages;
        const buyer = accounts[8];

        /**
         *
         * @param {BigNumber} weiAmountPaid
         * @param {BigNumber} weiBasePrice
         * @param {BigNumber} stageDiscount
         * @param {BigNumber} volumeBonus
         */
        function calculateTokens(weiAmountPaid, weiBasePrice, stageDiscount, volumeBonus) {
            return weiAmountPaid.div(weiBasePrice
                .mul(new BigNumber(100).minus(stageDiscount))
                .div(100)
            ).mul(volumeBonus.plus(100))
            .mul(oneToken)
            .div(100);
        }

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
                        discount: 0
                    },
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
                        name: 'Phase 10',
                        dates: [
                            startDate + utils.time.duration.minutes(100),
                            startDate + utils.time.duration.minutes(120),
                        ],
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: 10
                    }
                ];

                await sut.setStages(
                    discountStages.map(s => s.dates),
                    discountStages.map(s => s.discount),
                    discountStages.map(s => s.vestingTime),
                    {from: tokenOwner}
                );

                endDate = discountStages[2].dates[1];
            });

            it('should sell some tokens', async () => {
                const stage = discountStages[0];
                const crowdsaleWBalanceBefore = await token.balanceOf(sut.address);
                const swapWBalanceBefore = await token.balanceOf(swap);
                const swapSBalanceBefore = await originToken.balanceOf(swap);
                const serviceWalletSBalanceBefore = await originToken.balanceOf(serviceWallet);
                const serviceWalletBalanceBefore = await web3.eth.getBalance(serviceWallet);

                await utils.time.increaseTimeTo(stage.dates[0] + 10);

                await sut.buyTokens({ value: 10000, from: buyer }).should.be.fulfilled;

                (await token.balanceOf(buyer))
                    .should.bignumber.equal(oneToken.mul(100));

                // sale commission
                (await originToken.balanceOf(swap))
                    .should.bignumber.equal(swapSBalanceBefore.minus(oneToken.mul(10)));

                (await originToken.balanceOf(serviceWallet))
                    .should.bignumber.equal(serviceWalletSBalanceBefore.plus(oneToken.mul(10)));

                (await token.balanceOf(sut.address))
                    .should.bignumber.equal(
                        crowdsaleWBalanceBefore
                            // commission
                            .minus(oneToken.mul(10))
                            // purchase amount
                            .minus(oneToken.mul(100))
                    );

                (await token.balanceOf(swap))
                    .should.bignumber.equal(swapWBalanceBefore.plus(oneToken.mul(10)));

                (await web3.eth.getBalance(serviceWallet))
                    .should.bignumber.equal(serviceWalletBalanceBefore.plus(1000));

                (await web3.eth.getBalance(fund.address))
                    .should.bignumber.equal(9000);
            });

            it('should return change', async () => {
                const stage = discountStages[0];
                const buyValueWei = new BigNumber(100 * 200);
                const expectedChange = buyValueWei.div(2);
                const expectedWBalance = oneToken.mul(100);
                const buyerBalanceBefore = await web3.eth.getBalance(buyer);

                await utils.time.increaseTimeTo(stage.dates[0] + 10);

                await sut._outTokens(accounts[0], oneToken.mul(oneToken.minus(100)), {from: tokenOwner})
                    .should.be.fulfilled;

                await sut._setState(0, {from: tokenOwner})
                    .should.be.fulfilled;

                const receipt = await sut.buyTokens({value: buyValueWei, from: buyer}).should.be.fulfilled;
                const cost = await utils.getTransactionCost(receipt);
                const expectedBalance = buyerBalanceBefore
                    .minus(cost)
                    .minus(buyValueWei)
                    .plus(expectedChange);

                (await token.balanceOf(buyer))
                    .should.bignumber.equal(expectedWBalance);

                (await web3.eth.getBalance(buyer))
                    .should.bignumber.equal(expectedBalance);
            });

            it('should not sell some tokens if sale is not active', async () => {
                const someStage1 = discountStages[1];
                const someStage2 = discountStages[2];
                const someDate = someStage1.dates[1] + Math.ceil((someStage2.dates[0] - someStage1.dates[1]) / 2);

                await utils.time.increaseTimeTo(someDate);

                await sut.buyTokens({value: 1000000, from: buyer})
                    .should.be.rejectedWith(utils.EVMRevert);
            });

            describe('unsold tokens', async () => {
                describe('return unsold tokens after the end', async () => {
                    let txReceipt;
                    let logs;
                    let crowdsaleBalanceBefore;
                    let ownerBalanceBefore;

                    beforeEach(async () => {
                        await utils.time.increaseTimeTo(endDate + 10);

                        crowdsaleBalanceBefore = await token.balanceOf(sut.address);
                        ownerBalanceBefore = await token.balanceOf(tokenOwner);

                        txReceipt = await sut.claimRemainingTokens({from: tokenOwner})
                            .should.be.fulfilled;

                        logs = txReceipt.logs;
                    });

                    it('should return', async () => {
                        const crowdsaleBalanceAfter = await token.balanceOf(sut.address);
                        const ownerBalanceAfter = await token.balanceOf(tokenOwner);

                        crowdsaleBalanceAfter.should.bignumber.equal(0);
                        ownerBalanceAfter.should.bignumber.equal(crowdsaleBalanceBefore.plus(ownerBalanceBefore));
                    });

                    it('should emit on return', async () => {
                        const event = utils.expectEvent.inLogs(logs, 'UnsoldTokenReturned');

                        event.args.owner.should.eq(tokenOwner);
                        event.args.amount.should.be.bignumber.equal(crowdsaleBalanceBefore);
                    });
                });

                it('shouldn\'t return unsold tokens before the end', async () => {
                    (await sut.isEnded()).should.be.equal(false);
                    await sut.claimRemainingTokens({from: tokenOwner}).should.be.rejectedWith(utils.EVMRevert);
                });
            })

            it('should sell tokens from each stage', async () => {
                for (const stage of discountStages) {
                    const balanceBefore = await token.balanceOf(buyer);

                    await utils.time.increaseTimeTo(stage.dates[1] - 30);

                    await sut.buyTokens({ value: oneToken, from: buyer }).should.be.fulfilled;

                    const balanceAfter = await token.balanceOf(buyer);

                    balanceAfter
                        .minus(balanceBefore)
                        .toPrecision(6).should.bignumber
                            .equal(calculateTokens(oneToken, price, stage.discount, BigNumber.Zero).toPrecision(6));
                }
            });
        });

        describe('with volume bonuses', async () => {
            beforeEach(async () => {
                discountStages = [
                    {
                        name: 'Phase 0',
                        dates: [
                            startDate + utils.time.duration.minutes(60),
                            startDate + utils.time.duration.minutes(80)
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

                await sut.setStages(
                    discountStages.map(s => s.dates),
                    discountStages.map(s => s.discount),
                    discountStages.map(s => s.vestingTime),
                    {from: tokenOwner}
                ).should.be.fulfilled;

                await sut.setStageVolumeBonuses(0,
                    discountStages[0].volumeBonuses.map(vb => vb.boundary),
                    discountStages[0].volumeBonuses.map(vb => vb.bonus),
                    {from: tokenOwner}
                ).should.be.fulfilled;
            });

            it('should sell tokens with volume bonuses', async () => {
                const stage = discountStages[0];
                let totalBoughtBefore;
                let balance;

                await utils.time.increaseTimeTo(stage.dates[1] - 30);

                await sut.buyTokens({
                    value: stage.volumeBonuses[0].boundary.minus(1),
                    from: buyer
                })
                    .should.be.fulfilled;

                balance = await token.balanceOf(buyer);
                balance.should.bignumber
                    .equal(
                        calculateTokens(
                            stage.volumeBonuses[0].boundary.minus(1)
                            , price
                            , BigNumber.Zero, stage.volumeBonuses[0].bonus
                        )
                    );
                totalBoughtBefore = balance;

                await sut.buyTokens({
                    value: stage.volumeBonuses[0].boundary,
                    from: buyer
                }).should.be.fulfilled;

                balance = await token.balanceOf(buyer);
                balance.minus(totalBoughtBefore).should.bignumber
                    .equal(
                        calculateTokens(
                            stage.volumeBonuses[0].boundary
                            , price
                            , BigNumber.Zero, stage.volumeBonuses[1].bonus
                        )
                    );
                totalBoughtBefore = balance;

                await sut.buyTokens({
                    value: stage.volumeBonuses[1].boundary,
                    from: buyer
                }).should.be.fulfilled;

                balance = await token.balanceOf(buyer);
                balance.minus(totalBoughtBefore).toPrecision(8).should.bignumber
                    .equal(
                        calculateTokens(
                            stage.volumeBonuses[1].boundary
                            , price
                            , BigNumber.Zero, stage.volumeBonuses[2].bonus
                        ).toPrecision(8)
                    );
            });
        });
    });
});
