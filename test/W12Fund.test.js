require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const crowdsaleFixtures = require('./fixtures/crowdsale.js');
const tokesFixtures = require('./fixtures/tokens.js');

const W12Fund = artifacts.require('W12Fund');
const W12FundStub = artifacts.require('W12FundStub');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const WToken = artifacts.require('WToken');
const oneToken = new BigNumber(10).pow(18);

contract('W12Fund', async (accounts) => {
    let sut, swap, crowdsale, wtoken;
    let W12CrowdsaleFixture, StagesFixture, MilestoneFixture, W12TokenFixture, Fund;
    const sutOwner = accounts[0];
    const wtokenOwner = accounts[1];
    const buyer1 = accounts[3];
    const buyer2 = accounts[4];

    describe('initialization methods', async () => {
        beforeEach(async () => {
            sut = await W12Fund.new(crowdsale = utils.generateRandomAddress(), swap = utils.generateRandomAddress(), { from: sutOwner });
        });

        it('should set owner', async () => {
            (await sut.owner().should.be.fulfilled).should.be.equal(sutOwner);
        });
    });

    describe('stubbed fund', async () => {
        beforeEach(async () => {
            sut = await W12FundStub.new(crowdsale = accounts[1], swap = utils.generateRandomAddress(), utils.generateRandomAddress(), { from: sutOwner });
        });

        it('should record purchases', async () => {
            const expectedAmount = web3.toWei(1, 'ether');
            const expectedBuyer = utils.generateRandomAddress();
            const expectedTokenAmount = 100000;

            const receipt = await sut.recordPurchase(expectedBuyer, expectedTokenAmount, { value: expectedAmount, from: crowdsale }).should.be.fulfilled;

            receipt.logs[0].event.should.be.equal('FundsReceived');
            receipt.logs[0].args.buyer.should.be.equal(expectedBuyer);
            receipt.logs[0].args.etherAmount.should.bignumber.equal(expectedAmount);
            receipt.logs[0].args.tokenAmount.should.bignumber.equal(expectedTokenAmount);
        });

        it('should reject record purchases when called not from crowdsale address', async () => {
            const expectedAmount = web3.toWei(1, 'ether');
            const expectedBuyer = utils.generateRandomAddress();

            await sut.recordPurchase(expectedBuyer, expectedAmount, { from: utils.generateRandomAddress() }).should.be.rejected;
        });

        it('should return zeros if there was no prior investment records', async () => {
            const actualResult = await sut.getInvestmentsInfo(utils.generateRandomAddress()).should.be.fulfilled;

            actualResult[0].should.bignumber.equal(BigNumber.Zero);
            actualResult[1].should.bignumber.equal(BigNumber.Zero);
        });

        it('should record average price of token purchase', async () => {
            const buyer = accounts[2];
            const purchases = [
                {
                    amount: web3.toWei(0.5, 'ether'),
                    tokens: web3.toWei(0.005, 'ether')
                },
                {
                    amount: web3.toWei(0.7, 'ether'),
                    tokens: web3.toWei(0.015, 'ether')
                },
                {
                    amount: web3.toWei(0.15, 'ether'),
                    tokens: web3.toWei(0.105, 'ether')
                },
                {
                    amount: web3.toWei(1, 'ether'),
                    tokens: web3.toWei(0.2, 'ether')
                }
            ];
            let totalPaid = BigNumber.Zero;
            let totalTokensBought = BigNumber.Zero;

            for (const purchase of purchases) {
                await sut.recordPurchase(buyer, purchase.tokens, { from: crowdsale, value: purchase.amount }).should.be.fulfilled;

                totalPaid = totalPaid.plus(purchase.amount);
                totalTokensBought = totalTokensBought.plus(purchase.tokens);
            }

            const actualResult = await sut.getInvestmentsInfo(buyer).should.be.fulfilled;

            actualResult[0].should.bignumber.equal(totalTokensBought);
            actualResult[1].should.bignumber.equal(totalPaid.div(totalTokensBought).toFixed(0));
        });
    });

    describe('refund', async () => {
        const crawdsaleOwner = accounts[0];
        const fundOwner = accounts[0];
        const tokenOwner = accounts[1];
        const mintAmount = oneToken.mul(10000);

        beforeEach(async () => {
            W12TokenFixture = await tokesFixtures.createW12Token(tokenOwner);
            W12CrowdsaleFixture = await crowdsaleFixtures.createW12Crowdsale(
                {
                    startDate: web3.eth.getBlock('latest').timestamp + 60,
                    serviceWalletAddress: utils.generateRandomAddress(),
                    swapAddress: utils.generateRandomAddress(),
                    price: 10,
                    serviceFee: 10,
                    fundAddress: utils.generateRandomAddress()
                },
                crawdsaleOwner,
                W12TokenFixture.token
            );
            StagesFixture = await crowdsaleFixtures.setTestStages(
                web3.eth.getBlock('latest').timestamp + 60,
                W12CrowdsaleFixture.W12Crowdsale,
                crawdsaleOwner
            );
            MilestoneFixture = await crowdsaleFixtures.setTestMilestones(
                web3.eth.getBlock('latest').timestamp + 60,
                W12CrowdsaleFixture.W12Crowdsale,
                crawdsaleOwner
            );

            Fund = await W12FundStub.new(
                W12CrowdsaleFixture.W12Crowdsale.address,
                W12CrowdsaleFixture.args.swapAddress,
                W12TokenFixture.token.address,
                {from: fundOwner}
            );

            await W12TokenFixture.token.mint(buyer1, mintAmount, 0, {from: tokenOwner});
            await W12TokenFixture.token.mint(buyer2, mintAmount, 0, {from: tokenOwner});
            await W12TokenFixture.token.approve(Fund.address, mintAmount, {from: buyer1});
            await W12TokenFixture.token.approve(Fund.address, mintAmount, {from: buyer2});
        });

        describe('test `getRefundAmount` method', async () => {
            it('should return correct amount', async () => {
                utils.time.increaseTimeTo(MilestoneFixture.milestones[0].withdrawalWindow - 60);
                // case 1
                // W12Fund.totalFunded: 0.1
                // W12Fund balance: 0.1 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                await Fund.recordPurchase(buyer1, oneToken.mul(20), {
                    from: crawdsaleOwner,
                    value: web3.toWei(0.1, 'ether')
                }).should.be.fulfilled;

                const expectedRefundAmount1 = utils.calculateRefundAmount(
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    oneToken.mul(20),
                    oneToken.mul(20)
                );

                const tokensToReturn1 = oneToken.mul(20);
                const refundAmount1 = await Fund.getRefundAmount(tokensToReturn1, { from: buyer1 }).should.be.fulfilled;

                refundAmount1.should.bignumber.eq(expectedRefundAmount1);

                // case 2
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0.3 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH
                await Fund.recordPurchase(buyer2, oneToken.mul(30), {
                    from: crawdsaleOwner,
                    value: web3.toWei(0.2, 'ether')
                }).should.be.fulfilled;

                const expectedRefundAmount2 = utils.calculateRefundAmount(
                    web3.toWei(0.3, 'ether'),
                    web3.toWei(0.3, 'ether'),
                    web3.toWei(0.2, 'ether'),
                    oneToken.mul(30),
                    oneToken.mul(15)
                );
                const tokensToReturn2 = oneToken.mul(15);
                const refundAmount2 = await Fund.getRefundAmount(tokensToReturn2, {from: buyer2}).should.be.fulfilled;

                refundAmount2.should.bignumber.eq(expectedRefundAmount2);

                // case 3
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0.2 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH

                await Fund._receiveFunds(web3.toWei(0.1, 'ether'), { from: buyer1 });

                const expectedRefundAmount3 = utils.calculateRefundAmount(
                    web3.toWei(0.2, 'ether'),
                    web3.toWei(0.3, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    oneToken.mul(20),
                    oneToken.mul(20)
                );
                const tokensToReturn3 = oneToken.mul(20);
                const refundAmount3 = await Fund.getRefundAmount(tokensToReturn3, {from: buyer1}).should.be.fulfilled;

                refundAmount3.should.bignumber.eq(expectedRefundAmount3);

                // case 4
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0.2 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH

                const expectedRefundAmount4 = web3.toWei(0, 'ether');
                const tokensToReturn4 = oneToken.mul(20);
                const refundAmount4 = await Fund.getRefundAmount(tokensToReturn4, {from: utils.generateRandomAddress()}).should.be.fulfilled;

                refundAmount4.should.bignumber.eq(expectedRefundAmount4);

                // case 5
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH

                await Fund._receiveFunds(web3.toWei(0.2, 'ether'), {from: buyer1});

                const expectedRefundAmount5 = utils.calculateRefundAmount(
                    web3.toWei(0, 'ether'),
                    web3.toWei(0.3, 'ether'),
                    web3.toWei(0.2, 'ether'),
                    oneToken.mul(30),
                    oneToken.mul(20)
                );
                const tokensToReturn5 = oneToken.mul(20);
                const refundAmount5 = await Fund.getRefundAmount(tokensToReturn5, {from: buyer2}).should.be.fulfilled;

                refundAmount5.should.bignumber.eq(expectedRefundAmount5);
            });
        });

        describe('test `refund` method', async () => {
            it('should refund', async () => {
                utils.time.increaseTimeTo(MilestoneFixture.milestones[0].withdrawalWindow - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);
                const tokensToReturn = oneToken.mul(20);

                await Fund.recordPurchase(buyer1, tokens, {
                    from: crawdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                const expectedRefundAmount = utils.calculateRefundAmount(
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    tokens,
                    tokensToReturn
                );

                const buyer1BalanceBefore = web3.eth.getBalance(buyer1);

                (await Fund.totalRefunded()).should.bignumber.eq(0);

                const refundOperation = await Fund.refund(tokensToReturn, {from: buyer1}).should.be.fulfilled;

                (await Fund.totalRefunded()).should.bignumber.eq(expectedRefundAmount);

                const logs = refundOperation.logs;
                const operationCost = await utils.getTransactionCost(refundOperation);
                const investmentsInfo = await Fund.getInvestmentsInfo(buyer1).should.be.fulfilled;


                web3.eth.getBalance(Fund.address).should.bignumber.eq(funds.minus(expectedRefundAmount));
                web3.eth.getBalance(buyer1).should.bignumber.eq(buyer1BalanceBefore.plus(expectedRefundAmount).minus(operationCost));

                investmentsInfo[0].should.bignumber.equal(0);
                investmentsInfo[1].should.bignumber.equal(0);

                logs.length.should.be.equal(1);
                logs[0].event.should.be.equal('FundsRefunded');
                logs[0].args.buyer.should.be.equal(buyer1);
                logs[0].args.etherAmount.should.bignumber.eq(expectedRefundAmount);
                logs[0].args.tokenAmount.should.bignumber.eq(tokens);
            });

            it('should reject refund if provide zero tokens', async () => {
                utils.time.increaseTimeTo(MilestoneFixture.milestones[0].withdrawalWindow - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await Fund.recordPurchase(buyer1, tokens, {
                    from: crawdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                await Fund.refund(0, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if provided tokens amount gte investment number', async () => {
                utils.time.increaseTimeTo(MilestoneFixture.milestones[0].voteEndDate - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await Fund.recordPurchase(buyer1, tokens, {
                    from: crawdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                await Fund.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if address is not an investor address', async () => {
                utils.time.increaseTimeTo(MilestoneFixture.milestones[0].withdrawalWindow - 60);

                await Fund.refund(1, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if current time not in withdrawal window', async () => {
                utils.time.increaseTimeTo(MilestoneFixture.milestones[0].voteEndDate - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await Fund.recordPurchase(buyer1, tokens, {
                    from: crawdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                await Fund.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });
        })
    });
});
