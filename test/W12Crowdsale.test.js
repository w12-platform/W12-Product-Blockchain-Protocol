require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const WToken = artifacts.require('WToken');
const oneToken = new BigNumber(10).pow(18);

contract('W12Crowdsale', async (accounts) => {
    let sut;
    let token;
    const tokenOwner = accounts[9];
    let factory;
    let startDate;
    let price;
    const serviceWallet = utils.generateRandomAddress();
    const swap = utils.generateRandomAddress();
    let fund;

    beforeEach(async () => {
        factory = await W12CrowdsaleFactory.new();
        token = await WToken.new('TestToken', 'TT', 18, {from: tokenOwner});
        startDate = web3.eth.getBlock('latest').timestamp + 60;

        const txOutput = await factory.createCrowdsale(token.address, startDate, 100, serviceWallet, 10, swap, tokenOwner);
        const crowdsaleCreatedLogEntry = txOutput.logs.filter(l => l.event === 'CrowdsaleCreated')[0];

        sut = W12Crowdsale.at(crowdsaleCreatedLogEntry.args.crowdsaleAddress);
        fund = crowdsaleCreatedLogEntry.args.fundAddress;
        await token.addTrustedAccount(sut.address, {from: tokenOwner});
        await token.mint(sut.address, oneToken.mul(10000), 0, {from: tokenOwner});

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
            await factory.createCrowdsale(token.address, startDate - 100, 100, serviceWallet, 10, tokenOwner).should.be.rejected;
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
            .div(100)
            .toFixed(0);
        }

        describe('with discounts stages', async () => {
            beforeEach(async () => {
                discountStages = [
                    {
                        name: 'Phase 0',
                        endDate: startDate + openzeppelinHelpers.time.duration.minutes(60),
                        vestingTime: 0,
                        discount: 0
                    },
                    {
                        name: 'Phase 5',
                        endDate: startDate + openzeppelinHelpers.time.duration.minutes(90),
                        vestingTime: startDate + openzeppelinHelpers.time.duration.minutes(210),
                        discount: 5
                    },
                    {
                        name: 'Phase 10',
                        endDate: startDate + openzeppelinHelpers.time.duration.minutes(120),
                        vestingTime: startDate + openzeppelinHelpers.time.duration.minutes(180),
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
                openzeppelinHelpers.time.increaseTimeTo(startDate + 10);

                await sut.buyTokens({ value: 10000, from: buyer }).should.be.fulfilled;

                (await token.balanceOf(buyer)).should.bignumber.equal(100);
                web3.eth.getBalance(serviceWallet).should.bignumber.equal(1000);
                web3.eth.getBalance(fund).should.bignumber.equal(9000);
            });

            it('should sell tokens from each stage', async () => {
                for (const stage of discountStages) {
                    const balanceBefore = await token.balanceOf(buyer);
                    openzeppelinHelpers.time.increaseTimeTo(stage.endDate - 30);

                    await sut.buyTokens({ value: oneToken, from: buyer }).should.be.fulfilled;

                    const balanceAfter = await token.balanceOf(buyer);

                    balanceAfter.minus(balanceBefore).should.bignumber.equal(calculateTokens(oneToken, price, stage.discount, BigNumber.Zero));
                }
            });
        });

        describe('with volume bonuses', async () => {
            beforeEach(async () => {
                discountStages = [
                    {
                        name: 'Phase 0',
                        endDate: startDate + openzeppelinHelpers.time.duration.minutes(60),
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

                openzeppelinHelpers.time.increaseTimeTo(stage.endDate - 30);

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
                balance.minus(totalBoughtBefore).should.bignumber.equal(calculateTokens(stage.volumeBonuses[0].boundary.plus(1), price, BigNumber.Zero, stage.volumeBonuses[1].bonus));
            });
        });
    });
});
