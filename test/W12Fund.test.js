require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const CrowdsaleFixture = require('./fixtures/crowdsale.js');
const TokenFixture = require('./fixtures/tokens.js');
const FundFixture = require('./fixtures/fund.js');

const W12Fund = artifacts.require('W12Fund');
const W12FundStub = artifacts.require('W12FundStub');
const oneToken = new BigNumber(10).pow(18);

contract('W12Fund', async (accounts) => {
    let sut, swap, crowdsale;
    let crowdsaleFixture, milestoneFixture, tokenFixture, stagesFixture;
    const sutOwner = accounts[0];
    const tokenOwner = accounts[1];
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
            tokenFixture = await TokenFixture.createToken(tokenOwner);
            sut = await W12FundStub.new(
                crowdsale = accounts[1],
                swap = utils.generateRandomAddress(),
                tokenFixture.token.address,
                { from: sutOwner }
            );
        });

        it('should record purchases', async () => {
            const expectedAmount = web3.toWei(1, 'ether');
            const expectedBuyer = utils.generateRandomAddress();
            const expectedTokenAmount = oneToken.mul(1000);

            const receipt = await sut.recordPurchase(expectedBuyer, expectedTokenAmount, { value: expectedAmount, from: crowdsale }).should.be.fulfilled;

            receipt.logs[0].event.should.be.equal('FundsReceived');
            receipt.logs[0].args.buyer.should.be.equal(expectedBuyer);
            receipt.logs[0].args.weiAmount.should.bignumber.equal(expectedAmount);
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
                    tokens: oneToken.mul(5)
                },
                {
                    amount: web3.toWei(0.7, 'ether'),
                    tokens: oneToken.mul(15)
                },
                {
                    amount: web3.toWei(0.15, 'ether'),
                    tokens: oneToken.mul(105)
                },
                {
                    amount: web3.toWei(1, 'ether'),
                    tokens: oneToken.mul(200)
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
            actualResult[1].should.bignumber.equal(utils.round(totalPaid.mul(oneToken).div(totalTokensBought)));
        });
    });

    describe('refund', async () => {
        const crowdsaleOwner = accounts[0];
        const mintAmount = oneToken.mul(10000);
        const tokenPrice = new BigNumber(1000);

        beforeEach(async () => {
            tokenFixture = await TokenFixture.createToken(tokenOwner);

            crowdsaleFixture = await CrowdsaleFixture.createW12Crowdsale(
                {
                    startDate: web3.eth.getBlock('latest').timestamp + 60,
                    serviceWalletAddress: utils.generateRandomAddress(),
                    swapAddress: utils.generateRandomAddress(),
                    price: tokenPrice,
                    serviceFee: 10 * 100,
                    fundAddress: utils.generateRandomAddress()
                },
                crowdsaleOwner,
                tokenFixture.token
            );

            stagesFixture = await CrowdsaleFixture.setTestStages(
                web3.eth.getBlock('latest').timestamp + 60,
                crowdsaleFixture.W12Crowdsale,
                crowdsaleOwner
            );

            milestoneFixture = await CrowdsaleFixture.setTestMilestones(
                web3.eth.getBlock('latest').timestamp + 60,
                crowdsaleFixture.W12Crowdsale,
                crowdsaleOwner
            );

            sut = await W12FundStub.new(
                crowdsaleFixture.W12Crowdsale.address,
                crowdsaleFixture.args.swapAddress,
                tokenFixture.token.address,
                {from: sutOwner}
            );

            await tokenFixture.token.mint(buyer1, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.mint(buyer2, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer1});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer2});
        });

        describe('test `getRefundAmount` method', async () => {
            for (const milestoneIndex of [0,1,2]) {
                it(`should give full refund after milestone #${milestoneIndex} in case with one investor`, async () => {
                    const withdrawalEndDate = milestoneFixture.milestones[milestoneIndex].withdrawalWindow;
                    const purchaseTokens = new BigNumber(20);
                    const purchaseTokensRecord = oneToken.mul(20);
                    const purchaseCost = purchaseTokens.mul(tokenPrice);
                    const tokenDecimals = tokenFixture.args.decimals;

                    await utils.time.increaseTimeTo(withdrawalEndDate - 60);

                    await sut.recordPurchase(buyer1, purchaseTokensRecord, {
                        from: crowdsaleOwner,
                        value: purchaseCost
                    }).should.be.fulfilled;

                    const tokensToReturn = purchaseTokensRecord;
                    const expectedRefundAmount = utils.calculateRefundAmount(
                        purchaseCost,
                        purchaseCost,
                        purchaseCost,
                        purchaseTokensRecord,
                        tokensToReturn,
                        tokenDecimals
                    );

                    const refundAmount = await sut.getRefundAmount(tokensToReturn, {from: buyer1}).should.be.fulfilled;

                    refundAmount.should.bignumber.eq(expectedRefundAmount);
                });
            }

            it('partial refund in case with two investors', async () => {
                const withdrawalEndDate = milestoneFixture.milestones[0].withdrawalWindow;
                const records = [
                    {
                        buyer: buyer1,
                        tokens: new BigNumber(20),
                    },
                    {
                        buyer: buyer2,
                        tokens: new BigNumber(30),
                    }
                ];

                const tokenDecimals = tokenFixture.args.decimals;

                await utils.time.increaseTimeTo(withdrawalEndDate - 60);

                const recordsResult = await FundFixture.setPurchaseRecords(
                    sut,
                    records,
                    tokenPrice,
                    tokenDecimals,
                    crowdsaleOwner
                ).should.be.fulfilled;

                const tokensToReturn = recordsResult.args[1].boughtTokens.div(2); // 15 * 10 ** 18
                const expectedRefundAmount = utils.calculateRefundAmount(
                    recordsResult.totalCost,
                    recordsResult.totalCost,
                    recordsResult.args[1].cost,
                    recordsResult.args[1].boughtTokens,
                    tokensToReturn,
                    tokenDecimals
                );


                const refundAmount2 = await sut.getRefundAmount(tokensToReturn, {from: buyer2}).should.be.fulfilled;

                refundAmount2.should.bignumber.eq(expectedRefundAmount);
            });

            // it('partial refund in case with two investors and some refunded amount', async () => {
            //     const withdrawalEndDate = milestoneFixture.milestones[0].withdrawalWindow;
            //     const records = [
            //         {
            //             buyer: buyer1,
            //             tokens: new BigNumber(20),
            //         },
            //         {
            //             buyer: buyer2,
            //             tokens: new BigNumber(30),
            //         }
            //     ];

            //     const tokenDecimals = tokenFixture.args.decimals;
            //     const someAccount = accounts[5];

            //     await utils.time.increaseTimeTo(withdrawalEndDate - 60);

            //     const recordsResult = await FundFixture.setPurchaseRecords(
            //         sut,
            //         records,
            //         tokenPrice,
            //         tokenDecimals,
            //         crowdsaleOwner
            //     ).should.be.fulfilled;

            //     const refundedAmount = recordsResult.totalCost.mul(0.2);
            //     const newFundedAmount = recordsResult.totalCost.minus(refundedAmount);

            //     await sut._setTotalRefunded(refundedAmount, {from: someAccount}).should.be.fulfilled;
            //     await sut._receiveFunds(refundedAmount, {from: someAccount}).should.be.fulfilled;

            //     const tokensToReturn = recordsResult.args[1].boughtTokens.div(2); // 15 * 10 ** 18
            //     const expectedRefundAmount = utils.calculateRefundAmount(
            //         newFundedAmount,
            //         recordsResult.totalCost,
            //         recordsResult.args[1].cost,
            //         recordsResult.args[1].boughtTokens,
            //         tokensToReturn,
            //         tokenDecimals
            //     );

            //     const refundAmount = await sut.getRefundAmount(tokensToReturn, {from: buyer2}).should.be.fulfilled;

            //     refundAmount.should.bignumber.eq(expectedRefundAmount);
            // });

            it('should not refund on non investor address', async () => {
                const withdrawalEndDate = milestoneFixture.milestones[0].withdrawalWindow;
                const records = [
                    {
                        buyer: buyer1,
                        tokens: new BigNumber(20),
                    },
                    {
                        buyer: buyer2,
                        tokens: new BigNumber(30),
                    }
                ];

                const tokenDecimals = tokenFixture.args.decimals;

                await utils.time.increaseTimeTo(withdrawalEndDate - 60);

                const recordsResult = await FundFixture.setPurchaseRecords(
                    sut,
                    records,
                    tokenPrice,
                    tokenDecimals,
                    crowdsaleOwner
                ).should.be.fulfilled;

                const tokensToReturn = recordsResult.args[0].boughtTokens;
                const refundAmount = await sut.getRefundAmount(tokensToReturn, {from: accounts[2]}).should.be.fulfilled;

                refundAmount.should.bignumber.eq(BigNumber.Zero);
            });

            // it('should not refund in case with empty fund balance', async () => {
            //     const withdrawalEndDate = milestoneFixture.milestones[0].withdrawalWindow;
            //     const records = [
            //         {
            //             buyer: buyer1,
            //             tokens: new BigNumber(20),
            //         },
            //         {
            //             buyer: buyer2,
            //             tokens: new BigNumber(30),
            //         }
            //     ];

            //     const tokenDecimals = tokenFixture.args.decimals;
            //     const someAccount = accounts[5];

            //     await utils.time.increaseTimeTo(withdrawalEndDate - 60);

            //     const recordsResult = await FundFixture.setPurchaseRecords(
            //         sut,
            //         records,
            //         tokenPrice,
            //         tokenDecimals,
            //         crowdsaleOwner
            //     ).should.be.fulfilled;

            //     await sut._receiveFunds(recordsResult.totalCost, {from: someAccount});

            //     const tokensToReturn = recordsResult.args[1].boughtTokens.mul(0.4);
            //     const expectedRefundAmount = utils.calculateRefundAmount(
            //         0,
            //         recordsResult.totalCost,
            //         recordsResult.totalBought,
            //         recordsResult.args[1].boughtTokens,
            //         tokensToReturn,
            //         tokenDecimals
            //     );
            //     const refundAmount = await sut.getRefundAmount(tokensToReturn, {from: buyer2}).should.be.fulfilled;

            //     refundAmount.should.bignumber.eq(expectedRefundAmount);
            // });
        });

        describe('test `refund` method', async () => {
            it('should refund', async () => {
                utils.time.increaseTimeTo(milestoneFixture.milestones[0].withdrawalWindow - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);
                const tokensToReturn = oneToken.mul(20);
                const tokenDecimals = tokenFixture.args.decimals;

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                const expectedRefundAmount = utils.calculateRefundAmount(
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    web3.toWei(0.1, 'ether'),
                    tokens,
                    tokensToReturn,
                    tokenDecimals
                );

                const buyer1BalanceBefore = web3.eth.getBalance(buyer1);

                (await sut.totalRefunded()).should.bignumber.eq(0);

                const refundOperation = await sut.refund(tokensToReturn, {from: buyer1}).should.be.fulfilled;

                (await sut.totalRefunded()).should.bignumber.eq(expectedRefundAmount);

                const logs = refundOperation.logs;
                const operationCost = await utils.getTransactionCost(refundOperation);
                const investmentsInfoAfter = await sut.getInvestmentsInfo(buyer1).should.be.fulfilled;

                web3.eth.getBalance(sut.address).should.bignumber.eq(funds.minus(expectedRefundAmount));
                web3.eth.getBalance(buyer1).should.bignumber.eq(buyer1BalanceBefore.plus(expectedRefundAmount).minus(operationCost));

                investmentsInfoAfter[0].should.bignumber.equal(0);

                logs.length.should.be.equal(1);
                logs[0].event.should.be.equal('FundsRefunded');
                logs[0].args.buyer.should.be.equal(buyer1);
                logs[0].args.weiAmount.should.bignumber.eq(expectedRefundAmount);
                logs[0].args.tokenAmount.should.bignumber.eq(tokens);
            });

            it('should reject refund if provide zero tokens', async () => {
                utils.time.increaseTimeTo(milestoneFixture.milestones[0].withdrawalWindow - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                await sut.refund(0, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if provided tokens amount gte investment number', async () => {
                utils.time.increaseTimeTo(milestoneFixture.milestones[0].voteEndDate - 60);

                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if address is not an investor address', async () => {
                utils.time.increaseTimeTo(milestoneFixture.milestones[0].withdrawalWindow - 60);

                await sut.refund(1, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should reject refund if current time not in withdrawal window', async () => {
                const funds = new BigNumber(web3.toWei(0.1, 'ether'));
                const tokens = oneToken.mul(20);

                await sut.recordPurchase(buyer1, tokens, {
                    from: crowdsaleOwner,
                    value: funds
                }).should.be.fulfilled;

                utils.time.increaseTimeTo(milestoneFixture.milestones[0].endDate - 60);

                await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);

                utils.time.increaseTimeTo(milestoneFixture.milestones[0].withdrawalWindow + 60);

                await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
            });
        });
/*
        describe('test `getTrancheAmount` method', async () => {
            it('should return zero if crowdsale was not started yet', async () => {
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[0];

                await sut.sendTransaction({ value: totalFundedAmount, from: account }).should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account}).should.be.fulfilled;

                const expected = 0;
                const result = await sut.getTrancheAmount({ from: account }).should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            it('should return zero if withdrawal window was not open yet', async () => {
                const firstMilestone = milestoneFixture.milestones[0];
                const firstMilestoneEnd = firstMilestone.endDate;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[0];

                await utils.time.increaseTimeTo(firstMilestoneEnd - 60);

                await sut.sendTransaction({value: totalFundedAmount, from: account}).should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account}).should.be.fulfilled;

                const expected = 0;
                const result = await sut.getTrancheAmount({from: account}).should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            it('should return zero if balance is empty', async () => {
                const firstMilestone = milestoneFixture.milestones[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[0];

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                const expected = 0;
                const result = await sut.getTrancheAmount({from: account}).should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            it('should return non zero if balance is filled', async () => {
                const firstMilestone = milestoneFixture.milestones[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const percent = firstMilestone.tranchePercent;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[0];

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                await sut.sendTransaction({value: totalFundedAmount, from: account}).should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account}).should.be.fulfilled;

                const expected = utils.round(totalFundedAmount.mul(percent).div(100));
                const result = await sut.getTrancheAmount({from: account}).should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            it('should return non zero in case, where balance is filled and there is refunded resources', async () => {
                const firstMilestone = milestoneFixture.milestones[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const percent = firstMilestone.tranchePercent;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const totalRefundedAmount = totalFundedAmount.mul(0.1) // 10 wei
                const diff = totalFundedAmount.minus(totalRefundedAmount);
                const account = accounts[0];

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                await sut.sendTransaction({value: diff, from: account}).should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account}).should.be.fulfilled;
                await sut._setTotalRefunded(totalRefundedAmount, {from: account}).should.be.fulfilled;

                const expected = utils.round(diff.mul(percent).div(100));
                const result = await sut.getTrancheAmount({from: account}).should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            it('should return non zero in case, where balance is filled and last milestone was end', async () => {
                const lastMilestone = milestoneFixture.milestones[2];
                const withdrawalWindow = lastMilestone.withdrawalWindow;
                const percent = lastMilestone.tranchePercent;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[0];

                await utils.time.increaseTimeTo(withdrawalWindow + 60);

                await sut.sendTransaction({value: totalFundedAmount, from: account}).should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account}).should.be.fulfilled;

                const expected = utils.round(totalFundedAmount.mul(percent).div(100));
                const result = await sut.getTrancheAmount({from: account}).should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });
        });

        describe('test `tranche` method', async () => {
            it('should revert if sender is not owner', async () => {
                const firstMilestone = milestoneFixture.milestones[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[5];

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                await sut.sendTransaction({value: totalFundedAmount, from: account}).should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account}).should.be.fulfilled;

                await sut.tranche({from: account}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if tranche amount is zero', async () => {
                const account = await sut.owner();

                await sut.tranche({from: account}).should.be.rejectedWith(utils.EVMRevert);
            });

            it('should call tranche successful', async () => {
                const firstMilestone = milestoneFixture.milestones[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const percent = firstMilestone.tranchePercent;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = await sut.owner();

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                await sut.sendTransaction({value: totalFundedAmount, from: account}).should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account}).should.be.fulfilled;

                const expected = utils.round(totalFundedAmount.mul(percent).div(100));
                const expectedFundBalance = totalFundedAmount.minus(expected);
                const accountBalanceBefore = await web3.eth.getBalance(account);

                const tx = await sut.tranche({from: account}).should.be.fulfilled;
                const cost = await utils.getTransactionCost(tx);
                const log = tx.logs[0];
                const expectedAccountBalance = accountBalanceBefore.plus(expected).minus(cost);
                const fundBalance = await web3.eth.getBalance(sut.address);
                const accountBalance = await web3.eth.getBalance(account);

                fundBalance.should.bignumber.eq(expectedFundBalance);
                accountBalance.should.bignumber.eq(expectedAccountBalance);

                (await sut.completedTranches(withdrawalWindow)).should.be.equal(true);
                (await sut.getTrancheAmount()).should.bignumber.eq(0);

                log.should.to.be;
                log.event.should.be.equal('TrancheOperation');
                log.args.receiver.should.be.equal(account);
                log.args.amount.should.bignumber.eq(expected);
            });
        });
        */
    });
});
