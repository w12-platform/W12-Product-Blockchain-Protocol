import * as time from '../openzeppelin-solidity/test/helpers/increaseTime';

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .use(require('chai-arrays'))
    .should();

const crypto = require('crypto');

const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const WToken = artifacts.require('WToken');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const oneToken = new BigNumber(10).pow(18);

function generateRandomAddress() {
    return `0x${crypto.randomBytes(20).toString('hex')}`;
};

contract('W12Crowdsale', async (accounts) => {
    let sut;
    let token;
    const tokenOwner = accounts[9];
    let factory;
    let startDate;
    const serviceWallet = generateRandomAddress();
    const fund = generateRandomAddress();

    beforeEach(async () => {
        factory = await W12CrowdsaleFactory.new();
        token = await WToken.new('TestToken', 'TT', 18, {from: tokenOwner});
        startDate = web3.eth.getBlock('latest').timestamp + 60;

        const txOutput = await factory.createCrowdsale(token.address, startDate, 100, serviceWallet, 10, fund, tokenOwner);
        const crowdsaleCreatedLogEntry = txOutput.logs.filter(l => l.event === 'CrowdsaleCreated')[0];

        sut = W12Crowdsale.at(crowdsaleCreatedLogEntry.args.crowdsaleAddress);
        await token.addTrustedAccount(sut.address, {from: tokenOwner});
        await token.mint(sut.address, oneToken.mul(10000), 0, {from: tokenOwner});
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
        let expectedStages;

        beforeEach(async () => {
            expectedStages = [
                {
                    name: 'Phase 0',
                    endDate: startDate + time.duration.minutes(60),
                    vestingTime: 0,
                    discount: 0
                },
                {
                    name: 'Phase 5',
                    endDate: startDate + time.duration.minutes(90),
                    vestingTime: startDate + time.duration.minutes(210),
                    discount: 5
                },
                {
                    name: 'Phase 10',
                    endDate: startDate + time.duration.minutes(120),
                    vestingTime: startDate + time.duration.minutes(180),
                    discount: 10
                }
            ];

            await sut.setStages(
                expectedStages.map(s => s.endDate),
                expectedStages.map(s => s.discount),
                expectedStages.map(s => s.vestingTime),
                {from: tokenOwner}
            );
        });

        it('should be able to set stages', async () => {
            const actualNumberOfStages = await sut.stagesLength().should.be.fulfilled;

            actualNumberOfStages.should.bignumber.equal(expectedStages.length);

            let counter = expectedStages.length;
            expectedStages.forEach(async expectedStage => {
                const actualStage = await sut.stages(--counter).should.be.fulfilled;

                actualStage[0].should.bignumber.equal(expectedStage.endDate);
                actualStage[1].should.bignumber.equal(expectedStage.discount);
                actualStage[2].should.bignumber.equal(expectedStage.vestingTime);
            });
        });

        it('should be able to set milestones', async () => {
            await sut.setStageVolumeBonuses(0,
                [oneToken, oneToken.mul(2), oneToken.mul(10)],
                [1, 2, 10],
                {from: tokenOwner}).should.be.fulfilled;

            const actualVolumeBoundaries = (await sut.getStageVolumeBoundaries(0).should.be.fulfilled).map(x => x.toNumber());
            const actualVolumeBonuses = (await sut.getStageVolumeBonuses(0).should.be.fulfilled).map(x => x.toNumber());

            actualVolumeBoundaries.should.be.equalTo([oneToken.toNumber(), oneToken.mul(2).toNumber(), oneToken.mul(10).toNumber()]);
            actualVolumeBonuses.should.be.equalTo([1, 2, 10]);
        });

        it('should be able to buy some tokens', async () => {
            time.increaseTimeTo(startDate + 10);
            const buyer = accounts[8];

            await sut.buyTokens({ value: 10000, from: buyer }).should.be.fulfilled;

            (await token.balanceOf(buyer)).should.bignumber.equal(100);
            web3.eth.getBalance(serviceWallet).should.bignumber.equal(1000);
            web3.eth.getBalance(fund).should.bignumber.equal(9000);
        });

        it('should be able to buy tokens from each stage', async () => {
            const buyer = accounts[8];
            const price = await sut.price();

            for (const stage of expectedStages) {
                const balanceBefore = await token.balanceOf(buyer);
                time.increaseTimeTo(stage.endDate - 30);

                await sut.buyTokens({ value: oneToken, from: buyer }).should.be.fulfilled;

                const balanceAfter = await token.balanceOf(buyer);

                balanceAfter.should.bignumber.equal(balanceBefore.add(oneToken.div(price.mul(100 - stage.discount).div(100))).toFixed(0));
            }
        });
    });
});
