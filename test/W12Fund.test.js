require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const W12Fund = artifacts.require('W12Fund');
const W12FundStub = artifacts.require('W12FundStub');
const WToken = artifacts.require('WToken');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const oneToken = new BigNumber(10).pow(18);

contract('W12Fund', async (accounts) => {
    let sut, swap, crowdsale, wtoken;
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
        beforeEach(async () => {
            wtoken = await WToken.new('TestW12Token', 'TWT', 18, {from: wtokenOwner});
            swap = utils.generateRandomAddress();

            await wtoken.mint(wtokenOwner, oneToken.mul(10000), 0, {from: wtokenOwner});
            await wtoken.mint(buyer1, oneToken.mul(10000), 0, {from: wtokenOwner});
            await wtoken.mint(buyer2, oneToken.mul(10000), 0, {from: wtokenOwner});

            sut = await W12FundStub.new(crowdsale = accounts[1], swap, wtoken.address, {from: sutOwner});

            await wtoken.approve(sut.address, oneToken.mul(10000), {from: wtokenOwner});
            await wtoken.approve(sut.address, oneToken.mul(10000), {from: buyer1});
            await wtoken.approve(sut.address, oneToken.mul(10000), {from: buyer2});
        });

        describe('test `getRefundAmount` method', async () => {
            it('should return correct amount', async () => {
                // case 1
                // W12Fund.totalFunded: 0.1
                // W12Fund balance: 0.1 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                await sut.recordPurchase(buyer1, oneToken.mul(20), {
                    from: crowdsale,
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
                const refundAmount1 = await sut.getRefundAmount(tokensToReturn1, { from: buyer1 }).should.be.fulfilled;

                refundAmount1.should.bignumber.eq(expectedRefundAmount1);

                // case 2
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0.3 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH
                await sut.recordPurchase(buyer2, oneToken.mul(30), {
                    from: crowdsale,
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
                const refundAmount2 = await sut.getRefundAmount(tokensToReturn2, {from: buyer2}).should.be.fulfilled;

                refundAmount2.should.bignumber.eq(expectedRefundAmount2);

                // case 3
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0.2 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH

                await sut._receiveFunds(web3.toWei(0.1, 'ether'), { from: buyer1 });

                const expectedRefundAmount3 = utils.calculateRefundAmount(
                    web3.toWei(0.2, 'ether'),
                    web3.toWei(0.3, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    oneToken.mul(20),
                    oneToken.mul(20)
                );
                const tokensToReturn3 = oneToken.mul(20);
                const refundAmount3 = await sut.getRefundAmount(tokensToReturn3, {from: buyer1}).should.be.fulfilled;

                refundAmount3.should.bignumber.eq(expectedRefundAmount3);

                // case 4
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0.2 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH

                const expectedRefundAmount4 = web3.toWei(0, 'ether');
                const tokensToReturn4 = oneToken.mul(20);
                const refundAmount4 = await sut.getRefundAmount(tokensToReturn4, {from: utils.generateRandomAddress()}).should.be.fulfilled;

                refundAmount4.should.bignumber.eq(expectedRefundAmount4);

                // case 5
                // W12Fund.totalFunded: 0.3
                // W12Fund balance: 0 ETH
                // investors:
                //   buyer1: 20 tokens, 0.1 ETH
                //   buyer2: 30 tokens, 0.2 ETH

                await sut._receiveFunds(web3.toWei(0.2, 'ether'), {from: buyer1});

                const expectedRefundAmount5 = utils.calculateRefundAmount(
                    web3.toWei(0, 'ether'),
                    web3.toWei(0.3, 'ether'),
                    web3.toWei(0.2, 'ether'),
                    oneToken.mul(30),
                    oneToken.mul(20)
                );
                const tokensToReturn5 = oneToken.mul(20);
                const refundAmount5 = await sut.getRefundAmount(tokensToReturn5, {from: buyer2}).should.be.fulfilled;

                refundAmount5.should.bignumber.eq(expectedRefundAmount5);
            });
        });

        describe('test `refund` method', async () => {
            it('should refund', async () => {
                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);
                const tokensToReturn = oneToken.mul(20);

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsale,
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
                const refundOperation = await sut.refund(tokensToReturn, {from: buyer1}).should.be.fulfilled;
                const gasUsed = refundOperation.receipt.gasUsed;
                const logs = refundOperation.logs;
                const transaction = await web3.eth.getTransaction(refundOperation.tx);
                const gasPrice = transaction.gasPrice;
                const operationCost = gasPrice.mul(gasUsed);
                const investmentsInfo = await sut.getInvestmentsInfo(buyer1).should.be.fulfilled;

                web3.eth.getBalance(sut.address).should.bignumber.eq(funds.minus(expectedRefundAmount));
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
                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsale,
                    value: funds
                }).should.be.fulfilled;

                await sut.refund(0, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if provided tokens amount gte investment number', async () => {
                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsale,
                    value: funds
                }).should.be.fulfilled;

                await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if address is not an investor address', async () => {
                await sut.refund(1, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });
        })
    });
});
