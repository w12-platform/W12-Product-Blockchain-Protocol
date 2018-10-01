require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const CrowdsaleFixture = require('./fixtures/crowdsale.js');
const TokenFixture = require('./fixtures/tokens.js');
const FundFixture = require('./fixtures/fund.js');

const W12Fund = artifacts.require('W12Fund');
const W12FundStub = artifacts.require('W12FundStub');
const W12FundCrowdsaleStub = artifacts.require('W12FundCrowdsaleStub');
const oneToken = new BigNumber(10).pow(18);
const defaultStagesGenerator = utils.createStagesGenerator();
const defaultMilestonesGenerator = utils.createMilestonesGenerator();
const stagesDefaultFixture = (startDate) => defaultStagesGenerator([
    {
        dates: [
            startDate + utils.time.duration.minutes(40),
            startDate + utils.time.duration.minutes(60),
        ]
    },
    {
        dates: [
            startDate + utils.time.duration.minutes(80),
            startDate + utils.time.duration.minutes(100),
        ]
    },
    {
        dates: [
            startDate + utils.time.duration.minutes(120),
            startDate + utils.time.duration.minutes(140),
        ]
    }
]);
const milestonesDefaultFixture = (startDate) => defaultMilestonesGenerator([
    {
        endDate: startDate + utils.time.duration.days(10),
        voteEndDate: startDate + utils.time.duration.days(17),
        withdrawalWindow: startDate + utils.time.duration.days(20)
    },
    {
        endDate: startDate + utils.time.duration.days(21),
        voteEndDate: startDate + utils.time.duration.days(27),
        withdrawalWindow: startDate + utils.time.duration.days(30)
    },
    {
        endDate: startDate + utils.time.duration.days(31),
        voteEndDate: startDate + utils.time.duration.days(37),
        withdrawalWindow: startDate + utils.time.duration.days(40)
    }
]);


contract('W12Fund', async (accounts) => {
    let sut, swap, crowdsale;
    let crowdsaleFixture, milestonesFixture, tokenFixture, originTokenFixture, stagesFixture;
    const sutOwner = accounts[7];
    const tokenOwner = accounts[1];
    const buyer1 = accounts[3];
    const buyer2 = accounts[4];
    const trancheFeePercent = new BigNumber(utils.toInternalPercent(5));

    describe('initialization methods', async () => {
        beforeEach(async () => {
            sut = await W12Fund.new(0, trancheFeePercent, { from: sutOwner });
        });

        it('should set owner', async () => {
            (await sut.owner().should.be.fulfilled).should.be.equal(sutOwner);
        });
    });

    describe('stubbed fund', async () => {
        beforeEach(async () => {
            tokenFixture = await TokenFixture.createToken(tokenOwner);
            sut = await W12FundStub.new(
                0,
                crowdsale = accounts[1],
                swap = utils.generateRandomAddress(),
                tokenFixture.token.address,
                utils.generateRandomAddress(),
                trancheFeePercent,
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
        let crowdsaleMock, encodedMilestoneFixture, startData;

        const crowdsaleOwner = accounts[0];
        const mintAmount = oneToken.mul(10000);
        const tokenPrice = new BigNumber(1000);
        const setupMilestoneMockData = async (index) => {
            await crowdsaleMock._getCurrentMilestoneIndexMockData(index, true);
            await crowdsaleMock._getMilestoneMockData(
                index,
                encodedMilestoneFixture[index].dates[0],
                encodedMilestoneFixture[index].tranchePercent,
                encodedMilestoneFixture[index].dates[1],
                encodedMilestoneFixture[index].dates[2],
                encodedMilestoneFixture[index].nameHex,
                encodedMilestoneFixture[index].descriptionHex
            );
        };

        beforeEach(async () => {
            startData = web3.eth.getBlock('latest').timestamp;
            tokenFixture = await TokenFixture.createToken(tokenOwner);
            originTokenFixture = await TokenFixture.createToken(tokenOwner);
            milestonesFixture = milestonesDefaultFixture(startData);
            encodedMilestoneFixture = milestonesFixture
                .map(m =>
                    utils.encodeMilestoneParameters(
                        m.name,
                        m.description,
                        m.tranchePercent,
                        m.endDate,
                        m.voteEndDate,
                        m.withdrawalWindow
                    )
                )
            crowdsaleMock = await W12FundCrowdsaleStub.new(0, { crowdsaleOwner });
            sut = await W12FundStub.new(
                0,
                crowdsaleMock.address,
                utils.generateRandomAddress(),
                tokenFixture.token.address,
                utils.generateRandomAddress(),
                trancheFeePercent,
                {from: sutOwner}
            );

            await setupMilestoneMockData(0);
            await tokenFixture.token.mint(buyer1, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.mint(buyer2, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer1});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer2});
        });

        describe('getRefundAmount', async () => {

            for (const milestoneIndex of [1,2]) {
                it(`should calculate full refund amount after milestone #${milestoneIndex} in case with one investor`, async () => {
                    await setupMilestoneMockData(milestoneIndex);

                    const withdrawalEndDate = milestonesFixture[milestoneIndex].withdrawalWindow;
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
                const withdrawalEndDate = milestonesFixture[0].withdrawalWindow;
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

            it('should not refund on non investor address', async () => {
                const withdrawalEndDate = milestonesFixture[0].withdrawalWindow;
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
        });

        for (const milestoneIndex of [1, 2]) {
            it(`should refund buyer after milestone #${milestoneIndex} ended`, async () => {
                await setupMilestoneMockData(milestoneIndex);
                await utils.time.increaseTimeTo(milestonesFixture[milestoneIndex].withdrawalWindow - 60);

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

                const refundReceipt = await sut.refund(tokensToReturn, {from: buyer1})
                    .should.be.fulfilled;

                (await sut.totalRefunded()).should.bignumber.eq(expectedRefundAmount);

                const logs = refundReceipt.logs;
                const operationCost = await utils.getTransactionCost(refundReceipt);
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

            it(`should allow refund between milestone ${milestoneIndex} end date and the end of withdrawal window`, async () => {
                await setupMilestoneMockData(milestoneIndex);
                await utils.time.increaseTimeTo(milestonesFixture[milestoneIndex].endDate + 5);
                (await sut.refundAllowed()).should.be.true;

                await utils.time.increaseTimeTo(milestonesFixture[milestoneIndex].withdrawalWindow - 5);
                (await sut.refundAllowed()).should.be.true;
            });
        }

        it('should reject refund if provide zero tokens', async () => {
            await utils.time.increaseTimeTo(milestonesFixture[0].withdrawalWindow - 60);

            const funds = new BigNumber(web3.toWei(0.1, 'ether'));
            const tokens = oneToken.mul(20);

            await sut.recordPurchase(buyer1, tokens, {
                from: crowdsaleOwner,
                value: funds
            }).should.be.fulfilled;

            await sut.refund(0, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should reject refund if provided tokens amount gte investment number', async () => {
            await utils.time.increaseTimeTo(milestonesFixture[0].voteEndDate - 60);

            const funds = new BigNumber(web3.toWei(0.1, 'ether'));
            const tokens = oneToken.mul(20);

            await sut.recordPurchase(buyer1, tokens, {
                from: crowdsaleOwner,
                value: funds
            }).should.be.fulfilled;

            await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should reject refund if address is not an investor address', async () => {
            await utils.time.increaseTimeTo(milestonesFixture[0].withdrawalWindow - 60);

            await sut.refund(1, {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should reject refund if current time not in withdrawal window', async () => {
            const funds = new BigNumber(web3.toWei(0.1, 'ether'));
            const tokens = oneToken.mul(20);

            await sut.recordPurchase(buyer1, tokens, {
                from: crowdsaleOwner,
                value: funds
            }).should.be.fulfilled;

            await utils.time.increaseTimeTo(milestonesFixture[0].endDate - 60);

            await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);

            await utils.time.increaseTimeTo(milestonesFixture[0].withdrawalWindow + 60);

            await sut.refund(tokens.plus(oneToken), {from: buyer1}).should.be.rejectedWith(utils.EVMRevert);
        });
    });

    describe('tranche', async () => {
        let crowdsaleMock, encodedMilestoneFixture, startData;

        const swapAddress = accounts[1];
        const serviceWalletAddress = accounts[4];
        const crowdsaleOwner = accounts[0];
        const mintAmount = oneToken.mul(10000);
        const tokenPrice = new BigNumber(1000);
        const setupMilestoneMockData = async (index) => {
            await crowdsaleMock._getCurrentMilestoneIndexMockData(index, true);
            await crowdsaleMock._getLastMilestoneIndexMockData(encodedMilestoneFixture.length - 1, true);
            for (const milestoneIndex in  encodedMilestoneFixture) {
                await crowdsaleMock._getMilestoneMockData(
                    milestoneIndex,
                    encodedMilestoneFixture[milestoneIndex].dates[0],
                    encodedMilestoneFixture[milestoneIndex].tranchePercent,
                    encodedMilestoneFixture[milestoneIndex].dates[1],
                    encodedMilestoneFixture[milestoneIndex].dates[2],
                    encodedMilestoneFixture[milestoneIndex].nameHex,
                    encodedMilestoneFixture[milestoneIndex].descriptionHex
                );
            }
        };

        beforeEach(async () => {
            startData = web3.eth.getBlock('latest').timestamp;
            tokenFixture = await TokenFixture.createToken(tokenOwner);
            originTokenFixture = await TokenFixture.createToken(tokenOwner);
            milestonesFixture = milestonesDefaultFixture(startData);
            encodedMilestoneFixture = milestonesFixture
                .map(m =>
                    utils.encodeMilestoneParameters(
                        m.name,
                        m.description,
                        m.tranchePercent,
                        m.endDate,
                        m.voteEndDate,
                        m.withdrawalWindow
                    )
                )
            crowdsaleMock = await W12FundCrowdsaleStub.new(0, {crowdsaleOwner});
            sut = await W12FundStub.new(
                0,
                crowdsaleMock.address,
                swapAddress,
                tokenFixture.token.address,
                serviceWalletAddress,
                trancheFeePercent,
                {from: sutOwner}
            );

            await tokenFixture.token.mint(buyer1, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.mint(buyer2, mintAmount, 0, {from: tokenOwner});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer1});
            await tokenFixture.token.approve(sut.address, mintAmount, {from: buyer2});
        });

        describe('getTrancheAmount', async () => {

            it('should return zero if crowdsale was not started yet', async () => {
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[0];
                const expected = 0;

                await sut.sendTransaction({value: totalFundedAmount, from: account})
                    .should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account})
                    .should.be.fulfilled;

                const result = await sut.getTrancheAmount({from: account})
                    .should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            // TODO: windows always open

            // it('should return zero if withdrawal window was not open yet', async () => {
            //     const firstMilestone = milestonesFixture.milestones[0];
            //     const firstMilestoneEnd = firstMilestone.endDate;
            //     const totalFundedAmount = new BigNumber(100); // 100 wei
            //     const account = accounts[0];
            //     const expected = 0;

            //     await utils.time.increaseTimeTo(firstMilestoneEnd - 60);

            //     await sut.sendTransaction({value: totalFundedAmount, from: account})
            //         .should.be.fulfilled;
            //     await sut._setTotalFunded(totalFundedAmount, {from: account})
            //         .should.be.fulfilled;

            //     const result = await sut.getTrancheAmount({from: account})
            //         .should.be.fulfilled;

            //     result.should.bignumber.eq(expected);
            // });

            it('should return zero if balance is empty', async () => {
                await setupMilestoneMockData(0, 2);

                const firstMilestone = milestonesFixture[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const account = accounts[0];
                const expected = 0;

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                const result = await sut.getTrancheAmount({from: account})
                    .should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            it('should return non zero if balance is filled', async () => {
                await setupMilestoneMockData(0, 2);

                const firstMilestone = milestonesFixture[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const percent = firstMilestone.tranchePercent;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const account = accounts[0];
                const expected = utils.percent(totalFundedAmount, percent);

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                await sut.sendTransaction({value: totalFundedAmount, from: account})
                    .should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account})
                    .should.be.fulfilled;

                const result = await sut.getTrancheAmount({from: account})
                    .should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            it('should return non zero in case, where balance is filled and there is refunded resources', async () => {
                await setupMilestoneMockData(0, 2);

                const firstMilestone = milestonesFixture[0];
                const withdrawalWindow = firstMilestone.withdrawalWindow;
                const percent = firstMilestone.tranchePercent;
                const totalFundedAmount = new BigNumber(100); // 100 wei
                const totalRefundedAmount = totalFundedAmount.mul(0.1) // 10 wei
                const diff = totalFundedAmount.minus(totalRefundedAmount);
                const account = accounts[0];
                const expected = utils.round(diff.mul(percent).div(utils.toInternalPercent(100)));

                await utils.time.increaseTimeTo(withdrawalWindow - 60);

                await sut.sendTransaction({value: diff, from: account})
                    .should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account})
                    .should.be.fulfilled;
                await sut._setTotalRefunded(totalRefundedAmount, {from: account})
                    .should.be.fulfilled;

                const result = await sut.getTrancheAmount({from: account})
                    .should.be.fulfilled;

                result.should.bignumber.eq(expected);
            });

            // TODO: now it`s not work. it should work?

            // it('should return non zero in case, where balance is filled and last milestone was end', async () => {
            //     const lastMilestone = milestonesFixture.milestones[2];
            //     const withdrawalWindow = lastMilestone.withdrawalWindow;
            //     const percent = lastMilestone.tranchePercent;
            //     const totalFundedAmount = new BigNumber(100); // 100 wei
            //     const account = accounts[0];
            //     const expected = utils.round(totalFundedAmount.mul(percent).div(100));

            //     await utils.time.increaseTimeTo(withdrawalWindow + 60);

            //     await sut.sendTransaction({value: totalFundedAmount, from: account})
            //         .should.be.fulfilled;
            //     await sut._setTotalFunded(totalFundedAmount, {from: account})
            //         .should.be.fulfilled;

            //     const result = await sut.getTrancheAmount({from: account})
            //         .should.be.fulfilled;

            //     result.should.bignumber.eq(expected);
            // });
        });

        it('should revert if sender is not a owner', async () => {
            await setupMilestoneMockData(0, 2);

            const firstMilestone = milestonesFixture[0];
            const withdrawalWindow = firstMilestone.withdrawalWindow;
            const totalFundedAmount = new BigNumber(100); // 100 wei
            const account = accounts[5];

            await utils.time.increaseTimeTo(withdrawalWindow - 60);

            await sut.sendTransaction({value: totalFundedAmount, from: account})
                .should.be.fulfilled;
            await sut._setTotalFunded(totalFundedAmount, {from: account})
                .should.be.fulfilled;

            await sut.tranche({from: account}).should.be.rejectedWith(utils.EVMRevert);
        });

        it('should revert if tranche amount is zero', async () => {
            const account = await sut.owner();

            await sut.tranche({from: account})
                .should.be.rejectedWith(utils.EVMRevert);
        });

        describe('release tranche', async () => {
            const totalFundedAmount = new BigNumber(100); // 100 wei

            let milestones;
            const indexes = [0, 1, 2];
            let account;
            let total = BigNumber.Zero;

            beforeEach(async () => {
                milestones = milestonesFixture;
                account = await sut.owner();

                await sut.sendTransaction({value: totalFundedAmount, from: account})
                    .should.be.fulfilled;
                await sut._setTotalFunded(totalFundedAmount, {from: account})
                    .should.be.fulfilled;
            });

            describe(`release some tranche`, async () => {
                const index = 0;
                const anotherIndex = 2;
                const trancheMilestoneIndex = anotherIndex - 1;

                let txReceipt;
                let logs;
                let accountBalanceBefore;
                let milestone;
                let anotherMilestone;
                let withdrawalWindow, tranchePercent;
                let expected;
                let fee;
                let expectedWithoutFee;
                let expectedServiceWalletBalance;
                let expectedFundBalance;
                let trancheMilestone;


                beforeEach(async () => {
                    milestones = milestonesFixture;
                    milestone = milestones[index];
                    anotherMilestone = milestones[anotherIndex];
                    trancheMilestone = milestones[trancheMilestoneIndex];
                    account = await sut.owner();
                    accountBalanceBefore = await web3.eth.getBalance(account);
                    withdrawalWindow = milestone.withdrawalWindow;
                    tranchePercent = milestone.tranchePercent;
                    expected = utils.round(totalFundedAmount.mul(tranchePercent).div(utils.toInternalPercent(100)));
                    fee = utils.round(expected.mul(trancheFeePercent).div(utils.toInternalPercent(100)));
                    expectedWithoutFee = expected.sub(fee);
                    expectedServiceWalletBalance = (await web3.eth.getBalance(serviceWalletAddress)).plus(fee);
                    expectedFundBalance = totalFundedAmount.minus(expected);

                    await setupMilestoneMockData(index, 2);
                    await utils.time.increaseTimeTo(withdrawalWindow - 60);

                    txReceipt = await sut.tranche({from: account});

                    logs = txReceipt.logs;
                });

                it(`should release`, async () => {
                    txReceipt.should.be;

                    const cost = await utils.getTransactionCost(txReceipt);
                    const expectedAccountBalance = accountBalanceBefore
                        .plus(expected.minus(fee)).minus(cost);
                    const fundBalance = await web3.eth.getBalance(sut.address);
                    const accountBalance = await web3.eth.getBalance(account);
                    const serviceWalletBalance = await web3.eth.getBalance(serviceWalletAddress);

                    fundBalance.should.bignumber.eq(expectedFundBalance);
                    accountBalance.should.bignumber.eq(expectedAccountBalance);
                    serviceWalletBalance.should.bignumber.eq(expectedServiceWalletBalance);

                    (await sut.completedTranches(index)).should.be.equal(true);
                    (await sut.getTrancheAmount()).should.bignumber.eq(0);
                });

                it(`should release another`, async () => {
                    await setupMilestoneMockData(anotherIndex, 2);

                    const {endDate, withdrawalWindow} = anotherMilestone;
                    const {tranchePercent} = trancheMilestone;
                    const expectedAnother = utils.round(totalFundedAmount.mul(tranchePercent).div(utils.toInternalPercent(100)));
                    const fee = utils.round(expectedAnother.mul(trancheFeePercent).div(utils.toInternalPercent(100)));
                    const expectedServiceWalletBalance = (await web3.eth.getBalance(serviceWalletAddress))
                        .plus(fee);
                    const expectedFundBalance = totalFundedAmount.minus(expected.plus(expectedAnother));
                    const accountBalanceBefore = await web3.eth.getBalance(account);

                    await utils.time.increaseTimeTo(endDate - 60);

                    const txReceipt = await sut.tranche({from: account})
                        .should.be.fulfilled;

                    const cost = await utils.getTransactionCost(txReceipt);
                    const expectedAccountBalance = accountBalanceBefore
                        .plus(expectedAnother.minus(fee)).minus(cost);
                    const fundBalance = await web3.eth.getBalance(sut.address);
                    const accountBalance = await web3.eth.getBalance(account);
                    const serviceWalletBalance = await web3.eth.getBalance(serviceWalletAddress);

                    fundBalance.should.bignumber.eq(expectedFundBalance);
                    accountBalance.should.bignumber.eq(expectedAccountBalance);
                    serviceWalletBalance.should.bignumber.eq(expectedServiceWalletBalance);

                    (await sut.completedTranches(trancheMilestoneIndex)).should.be.equal(true);
                    (await sut.getTrancheAmount()).should.bignumber.eq(0);
                });

                it('should`t release', async () => {
                    await sut.tranche({from: account})
                        .should.be.rejectedWith(utils.EVMRevert);
                });

                it('should emmit event', async () => {
                    const event = await utils.expectEvent.inLogs(logs, 'TrancheReleased');

                    event.args.receiver.should.eq(account);
                    event.args.amount.should.be.bignumber.equal(expectedWithoutFee);
                });
            });

            // TODO: rework it in the future
            // describe('should release current and all previous not released tranches', async () => {
            //     for (let index of indexes) {
            //         it(`milestone #${index}`, async () => {
            //             const milestone = milestones[index];
            //             const {endDate, withdrawalWindow, tranchePercent: percent} = milestone;
            //             total = total.plus(percent);
            //             const expected = utils.round(totalFundedAmount.mul(total).div(100));
            //             const fee = utils.round(expected.mul(trancheFeePercent).div(100 * 100));
            //             const expectedServiceWalletBalance = (await web3.eth.getBalance(serviceWalletAddress))
            //                 .plus(fee);
            //             const expectedFundBalance = totalFundedAmount.minus(expected);
            //             const accountBalanceBefore = await web3.eth.getBalance(account);
            //
            //             await utils.time.increaseTimeTo(endDate - 60);
            //
            //             const tx = await sut.tranche({from: account})
            //                 .should.be.fulfilled;
            //
            //             const cost = await utils.getTransactionCost(tx);
            //             const expectedAccountBalance = accountBalanceBefore
            //                 .plus(expected.minus(fee)).minus(cost);
            //             const fundBalance = await web3.eth.getBalance(sut.address);
            //             const accountBalance = await web3.eth.getBalance(account);
            //             const serviceWalletBalance = await web3.eth.getBalance(serviceWalletAddress);
            //
            //             fundBalance.should.bignumber.eq(expectedFundBalance);
            //             accountBalance.should.bignumber.eq(expectedAccountBalance);
            //             serviceWalletBalance.should.bignumber.eq(expectedServiceWalletBalance);
            //
            //             (await sut.completedTranches(withdrawalWindow)).should.be.equal(true);
            //             (await sut.getTrancheAmount()).should.bignumber.eq(0);
            //         });
            //     }
            // });
        });
    });
});
