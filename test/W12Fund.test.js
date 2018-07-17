require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const W12Fund = artifacts.require('W12Fund');
const W12FundStub = artifacts.require('W12FundStub');
const WToken = artifacts.require('WToken');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const oneToken = new BigNumber(10).pow(18);

contract('W12Fund', async (accounts) => {
    let sut, swap, crowdsale;
    const sutOwner = accounts[0];

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
            sut = await W12FundStub.new(crowdsale = accounts[1], swap = utils.generateRandomAddress(), { from: sutOwner });
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
});
