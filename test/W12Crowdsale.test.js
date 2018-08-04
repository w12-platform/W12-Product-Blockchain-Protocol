require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const W12Fund = artifacts.require('W12Fund');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const WToken = artifacts.require('WToken');
const oneToken = new BigNumber(10).pow(18);

contract('W12Crowdsale', async (accounts) => {
    let sut;
    let token;
    const tokenOwner = accounts[9];
    let startDate;
    let price;
    const serviceWallet = utils.generateRandomAddress();
    const swap = utils.generateRandomAddress();
    let fund;

    beforeEach(async () => {
        token = await WToken.new('TestToken', 'TT', 18, {from: tokenOwner}).should.be.fulfilled;
        fund = await W12Fund.new({from: tokenOwner}).should.be.fulfilled;
        startDate = web3.eth.getBlock('latest').timestamp + 60;

        sut = await W12Crowdsale.new(token.address, 18, startDate, 100, serviceWallet, 10, fund.address, {from: tokenOwner}).should.be.fulfilled;
        await token.addTrustedAccount(sut.address, {from: tokenOwner}).should.be.fulfilled;
        await token.mint(sut.address, oneToken.mul(oneToken), 0, {from: tokenOwner}).should.be.fulfilled;
        await fund.setCrowdsale(sut.address, {from: tokenOwner}).should.be.fulfilled;

        price = await sut.price();
    });

    describe('constructor', async () => {
        it('should create crowdsale', async () => {
            (await sut.startDate()).should.bignumber.equal(startDate);
            (await sut.token()).should.be.equal(token.address);
            (await sut.price()).should.bignumber.equal(100);
            (await sut.serviceFee()).should.bignumber.equal(10);
            (await sut.serviceWallet()).should.be.equal(serviceWallet);
        });

        it('should reject crowdsale with start date in the past', async () => {
            await W12Crowdsale.new(token.address, 18, startDate - 1000, 100, serviceWallet, 10, fund.address, {from: tokenOwner}).should.be.rejected;
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
                        endDate: startDate + utils.time.duration.minutes(60),
                        vestingTime: 0,
                        discount: 0
                    },
                    {
                        name: 'Phase 5',
                        endDate: startDate + utils.time.duration.minutes(90),
                        vestingTime: startDate + utils.time.duration.minutes(210),
                        discount: 5
                    },
                    {
                        name: 'Phase 10',
                        endDate: startDate + utils.time.duration.minutes(120),
                        vestingTime: startDate + utils.time.duration.minutes(180),
                        discount: 10
                    }
                ];

                await sut.setStages(
                    discountStages.map(s => s.endDate),
                    discountStages.map(s => s.discount),
                    discountStages.map(s => s.vestingTime),
                    {from: tokenOwner}
                );
            });

            it('should set stages', async () => {
                const actualNumberOfStages = await sut.stagesLength().should.be.fulfilled;

                actualNumberOfStages.should.bignumber.equal(discountStages.length);

                let counter = discountStages.length;
                discountStages.forEach(async expectedStage => {
                    const actualStage = await sut.stages(--counter).should.be.fulfilled;

                    actualStage[0].should.bignumber.equal(expectedStage.endDate);
                    actualStage[1].should.bignumber.equal(expectedStage.discount);
                    actualStage[2].should.bignumber.equal(expectedStage.vestingTime);
                });
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

            it('should sell some tokens', async () => {
                utils.time.increaseTimeTo(startDate + 10);

                await sut.buyTokens({ value: 10000, from: buyer }).should.be.fulfilled;

                (await token.balanceOf(buyer)).should.bignumber.equal(oneToken.mul(100));
                web3.eth.getBalance(serviceWallet).should.bignumber.equal(1000);
                web3.eth.getBalance(fund.address).should.bignumber.equal(9000);
            });

            it('should sell tokens from each stage', async () => {
                for (const stage of discountStages) {
                    const balanceBefore = await token.balanceOf(buyer);
                    utils.time.increaseTimeTo(stage.endDate - 30);

                    await sut.buyTokens({ value: oneToken, from: buyer }).should.be.fulfilled;

                    const balanceAfter = await token.balanceOf(buyer);

                    balanceAfter.minus(balanceBefore).toPrecision(6).should.bignumber.equal(calculateTokens(oneToken, price, stage.discount, BigNumber.Zero).toPrecision(6));
                }
            });

            describe('when working with milestones', async () => {
                let expectedMilestones;
                let encodedMilestones;

                beforeEach(async () => {
                    startDate = web3.eth.getBlock('latest').timestamp + 60;

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
                            endDate: startDate + utils.time.duration.days(20),
                            tranchePercent: 35,
                            voteEndDate: startDate + utils.time.duration.days(27),
                            withdrawalWindow: startDate + utils.time.duration.days(30)
                        },
                        {
                            name: "Milestone 3 name",
                            description: "Milestone 3 description",
                            endDate: startDate + utils.time.duration.days(30),
                            tranchePercent: 35,
                            voteEndDate: startDate + utils.time.duration.days(37),
                            withdrawalWindow: startDate + utils.time.duration.days(40)
                        }
                    ];

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
                    );
                });

                it('should set milestones', async () => {
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

                it('should return current milestone index', async () => {
                    utils.time.increaseTimeTo(discountStages[discountStages.length - 1].endDate - utils.time.duration.minutes(1));
                    (await sut.getCurrentMilestoneIndex().should.be.fulfilled).should.bignumber.equal(0);

                    let expectedIndex = 0;
                    for (const milestone of expectedMilestones) {
                        utils.time.increaseTimeTo(milestone.endDate - utils.time.duration.minutes(10));

                        const actualIndex = await sut.getCurrentMilestoneIndex().should.be.fulfilled;

                        actualIndex.should.bignumber.equal(expectedIndex);

                        expectedIndex++;
                    }

                    utils.time.increaseTimeTo(expectedMilestones[expectedMilestones.length - 1].endDate + utils.time.duration.minutes(1));
                    (await sut.getCurrentMilestoneIndex().should.be.fulfilled).should.bignumber.equal(expectedMilestones.length - 1);
                });
            });
        });

        describe('with volume bonuses', async () => {
            beforeEach(async () => {
                discountStages = [
                    {
                        name: 'Phase 0',
                        endDate: startDate + utils.time.duration.minutes(60),
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
                    discountStages.map(s => s.endDate),
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

                utils.time.increaseTimeTo(stage.endDate - 30);

                await sut.buyTokens({ value: stage.volumeBonuses[0].boundary.minus(1), from: buyer }).should.be.fulfilled;
                balance = await token.balanceOf(buyer);
                balance.should.bignumber.equal(calculateTokens(stage.volumeBonuses[0].boundary.minus(1), price, BigNumber.Zero, BigNumber.Zero));
                totalBoughtBefore = balance;

                await sut.buyTokens({ value: stage.volumeBonuses[0].boundary, from: buyer }).should.be.fulfilled;
                balance = await token.balanceOf(buyer);
                balance.minus(totalBoughtBefore).should.bignumber.equal(calculateTokens(stage.volumeBonuses[0].boundary, price, BigNumber.Zero, stage.volumeBonuses[1].bonus));
                totalBoughtBefore = balance;

                await sut.buyTokens({ value: stage.volumeBonuses[0].boundary.plus(1), from: buyer }).should.be.fulfilled;
                balance = await token.balanceOf(buyer);
                balance.minus(totalBoughtBefore).toPrecision(8).should.bignumber.equal(calculateTokens(stage.volumeBonuses[0].boundary.plus(1), price, BigNumber.Zero, stage.volumeBonuses[1].bonus).toPrecision(8));
            });
        });
    });
});
