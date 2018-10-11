require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');
const testFee = require('../parts/transferringFeeTests');
const testPurchase = require('../parts/transferringPurchaseTests');

const PurchaseProcessingMock = artifacts.require('PurchaseProcessingMock');
const Token = artifacts.require('WToken');
const ten = new BigNumber(10);

contract('PurchaseProcessing', (accounts) => {
    const exchangerAddress = accounts[1];
    const serviceWalletAddress = accounts[2];
    const investor1Address = accounts[3];
    const investor2Address = accounts[4];
    const ctx = {};

    beforeEach(async () => {
        ctx.lib = await PurchaseProcessingMock.new();
    });

    describe('checkInvoiceInput', () => {

        describe('correct arguments', () => {

            beforeEach(async () => {
                ctx.Tx = ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 1, 1, 0, 18);
            });

            it('should`t revert', async () => {
                await ctx.Tx
                    .should.to.be.fulfilled;
            });

            it('should check result to be true', async () => {
                const actual = await ctx.Tx;

                actual.should.to.be.true;
            });
        });

        describe('incorrect arguments', () => {

            it('should to be false for `paymentAmount`', async () => {
                const actual = await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 0, 1, 1, 1, 0, 18);

                actual.should.to.be.false;
            });

            it('should to be false for `methodUSDRate`', async () => {
                const actual = await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 0, 1, 1, 0, 18);

                actual.should.to.be.false;
            });

            it('should to be false for `tokenUSDRate`', async () => {
                const actual = await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 0, 1, 0, 18);

                actual.should.to.be.false;
            });

            it('should to be false for `currentBalanceInTokens`', async () => {
                const actual = await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 1, 0, 0, 18);

                actual.should.to.be.false;
            });

            it('should to be false for `methodDecimal`', async () => {
                const actual = await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 1, 1, 0, 0);

                actual.should.to.be.false;
            });
        });
    });

    describe('get bonus', () => {
        beforeEach(async () => {
            ctx.Tx = ctx.lib.getBonus(2, [1, 2, 3], [1, 2, 3]);
        });

        it('should return', async () => {
            const actual = await ctx.Tx;

            actual.should.bignumber.eq(2);
        });
    });

    describe('prepare invoice', () => {

        describe('should work', () => {

            beforeEach(async () => {
                ctx.Tx = ctx.lib.invoice(web3.fromUtf8('ETH'), 1, 0, [], [], web3.toWei(1, 'ether'), 1, 0, 18, 1);
            });

            it('should`t revert', async () => {
                await ctx.Tx
                    .should.to.be.fulfilled;
            });

            it('should produce correct result', async () => {
                const actual = await ctx.Tx;

                actual[0].should.bignumber.eq(1);
                actual[1].should.bignumber.eq(1);
                actual[2].should.bignumber.eq(1);
                actual[3].should.bignumber.eq(0);
                actual[4].should.bignumber.eq(1);
            });
        });

        describe('calculation with different values', () => {
            const getTitle = (index, expected, _argument) =>
                `should work for case #${index}` +
                `\n\t * token bought amount ${expected.tokenAmount.toString()} ` +
                `\n\t * cost ${expected.cost.toString()} ` +
                `\n\t * change ${expected.change.toString()} ` +
                `\n\t * round loss ${utils.getPurchaseRoundLoss(
                    expected.tokenAmount, expected.cost,
                    _argument[5], _argument[6],
                    _argument[7], _argument[8]
                ).toString()} USD`
            ;
            const _arguments = [
                [
                    web3.fromUtf8('TT'), ten.pow(10),
                    utils.toInternalPercent(22.22),
                    [utils.toInternalUSD(1)], [utils.toInternalPercent(3.33)],
                    utils.toInternalUSD(1.00123), utils.toInternalUSD(0.02123),
                    5, 10, BigNumber.UINT_MAX.div(2)
                ],
                [
                    web3.fromUtf8('TT'), ten.pow(5),
                    utils.toInternalPercent(32.12),
                    [utils.toInternalUSD(1)], [utils.toInternalPercent(33.33)],
                    utils.toInternalUSD(1.19123), utils.toInternalUSD(1.12123),
                    10, 5, BigNumber.UINT_MAX.div(2)
                ],
                [
                    web3.fromUtf8('TT'), 5,
                    utils.toInternalPercent(32.12),
                    [utils.toInternalUSD(1)], [utils.toInternalPercent(11.79)],
                    utils.toInternalUSD(0.5), utils.toInternalUSD(0.01),
                    2, 0, BigNumber.UINT_MAX.div(2)
                ],
                [
                    web3.fromUtf8('TT'), ten.pow(75),
                    utils.toInternalPercent(7.15),
                    [utils.toInternalUSD(1)], [utils.toInternalPercent(19.79)],
                    utils.toInternalUSD(3.9712), utils.toInternalUSD(0.019654),
                    3, 75, BigNumber.UINT_MAX.div(2)
                ],
                [
                    web3.fromUtf8('TT'), ten.pow(75),
                    utils.toInternalPercent(1.15),
                    [utils.toInternalUSD(1)], [utils.toInternalPercent(14.79)],
                    utils.toInternalUSD(3.9712), utils.toInternalUSD(1.3713),
                    65, 75, BigNumber.UINT_MAX
                ],
                [
                    web3.fromUtf8('TT'), 5,
                    utils.toInternalPercent(32.12),
                    [utils.toInternalUSD(1)], [utils.toInternalPercent(11.79)],
                    utils.toInternalUSD(0.5), utils.toInternalUSD(0.01),
                    2, 0, 200
                ],
                [
                    web3.fromUtf8('TT'), 10,
                    utils.toInternalPercent(0),
                    [], [],
                    utils.toInternalUSD(1), utils.toInternalUSD(1),
                    0, 0, 5
                ],
            ];

            for (const index in _arguments) {
                const expected = utils.calculatePurchase(..._arguments[index]);

                it(getTitle(index, expected, _arguments[index]), async () => {
                    const actual = await ctx.lib.invoice(..._arguments[index]);

                    actual[0].should.bignumber.eq(expected.tokenAmount);
                    actual[1].should.bignumber.eq(expected.cost);
                    actual[2].should.bignumber.eq(expected.costUSD);
                    actual[3].should.bignumber.eq(expected.change);
                    actual[4].should.bignumber.eq(expected.actualTokenPriceUSD);
                });
            }
        });

        describe('limits, security, checks', () => {
            it('should revert if payment less then price amount of one token', async () => {
                const _arguments = [
                    web3.fromUtf8('TT'), ten.pow(10),
                    utils.toInternalPercent(1.15),
                    [utils.toInternalUSD(1)], [utils.toInternalPercent(14.79)],
                    utils.toInternalUSD(0.012), utils.toInternalUSD(1.3713),
                    10, 10, BigNumber.UINT_MAX.div(2)
                ];

                await ctx.lib.invoice(..._arguments)
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });
        });
    });

    describe('fee calculation', () => {
        beforeEach(async () => {
            ctx.Tx = ctx.lib.fee(10, 10, utils.toInternalPercent(10), utils.toInternalPercent(10));
        });

        it('should`t revert', async () => {
            await ctx.Tx
                .should.to.be.fulfilled;
        });

        it('should return correct result', async () => {
            const actual = await ctx.Tx;

            actual[0].should.bignumber.eq(utils.percent(10, utils.toInternalPercent(10)));
            actual[1].should.bignumber.eq(utils.percent(10, utils.toInternalPercent(10)));
        });
    });

    describe('transferring fee', () => {
        const oneToken = new BigNumber(10 ** 18);
        const sender = accounts[0];

        beforeEach(async () => {
            ctx.Token1 = await Token.new('1', '1', 18);
            ctx.Token2 = await Token.new('2', '2', 18);
            ctx.Token3 = await Token.new('3', '3', 18);
        });

        describe('pay with token', () => {
            const mint = 1000;
            const fee = [oneToken, oneToken];
            const subCtx = {};

            beforeEach(async () => {
                subCtx.originToken = ctx.Token1;
                subCtx.WToken = ctx.Token2;
                subCtx.PaymentToken = ctx.Token3;
                subCtx.contractAddress = ctx.lib.address;
                subCtx.paymentDestinationAddress = ctx.lib.address;
                subCtx.serviceWalletAddress = serviceWalletAddress;
                subCtx.exchangerAddress = exchangerAddress;
                subCtx.expectedFee = fee;

                await ctx.Token1.mint(exchangerAddress, oneToken.mul(mint), 0);
                await ctx.Token2.mint(ctx.lib.address, oneToken.mul(mint), 0);
                await ctx.Token3.mint(sender, oneToken.mul(mint), 0);

                // approve to spend fee from exchanger
                await ctx.Token1.approve(ctx.lib.address, oneToken.mul(mint), {from: exchangerAddress});
                await ctx.Token3.approve(ctx.lib.address, fee[1], {from: sender});

                ctx.Tx = subCtx.Tx = () => ctx.lib.transferFee(
                    fee,
                    web3.fromUtf8('1'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    ctx.Token1.address,
                    exchangerAddress,
                    serviceWalletAddress,
                    { from: sender }
                );
            });

            testFee.defaultProcess(subCtx);
            testFee.whenPaymentWithToken(subCtx);
        });

        describe('pay with eth', () => {
            const mint = 1000;
            const fee = [10, 10];
            const subCtx = {};

            beforeEach(async () => {
                subCtx.originToken = ctx.Token1;
                subCtx.WToken = ctx.Token2;
                subCtx.contractAddress = ctx.lib.address;
                subCtx.paymentDestinationAddress = ctx.lib.address;
                subCtx.serviceWalletAddress = serviceWalletAddress;
                subCtx.exchangerAddress = exchangerAddress;
                subCtx.expectedPaymentETHAmount = 0;
                subCtx.expectedFee = fee;

                await ctx.Token1.mint(exchangerAddress, oneToken.mul(mint), 0);
                await ctx.Token2.mint(ctx.lib.address, oneToken.mul(mint), 0);

                // approve to spend fee from exchanger
                await ctx.Token1.approve(ctx.lib.address, oneToken.mul(mint), {from: exchangerAddress});


                ctx.Tx = subCtx.Tx = async () => {
                    await web3.eth.sendTransaction({
                        value: fee[1],
                        from: accounts[0],
                        to: ctx.lib.address
                    });

                    return await ctx.lib.transferFee(
                        fee,
                        web3.fromUtf8('ETH'),
                        0,
                        ctx.Token2.address,
                        ctx.Token1.address,
                        exchangerAddress,
                        serviceWalletAddress
                    );
                }
            });

            testFee.defaultProcess(subCtx);
            testFee.whenPaymentWithETH(subCtx);
        });

        describe('security and checks', () => {
            const mint = 1000;
            const fee = [10, 10];

            beforeEach(async () => {
                await ctx.Token1.mint(exchangerAddress, oneToken.mul(mint), 0);
                await ctx.Token2.mint(ctx.lib.address, oneToken.mul(mint), 0);

                // approve to spend fee from exchanger
                await ctx.Token1.approve(ctx.lib.address, oneToken.mul(mint), {from: exchangerAddress});
                await web3.eth.sendTransaction({value: fee[1], from: accounts[0], to: ctx.lib.address});
            });

            it('should revert if method token address is zero', async () => {
                await ctx.lib.transferFee(
                    fee,
                    web3.fromUtf8('TOK'),
                    0,
                    ctx.Token2.address,
                    ctx.Token1.address,
                    exchangerAddress,
                    serviceWalletAddress
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if wtoken address is zero', async () => {
                await ctx.lib.transferFee(
                    fee,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    0,
                    ctx.Token1.address,
                    exchangerAddress,
                    serviceWalletAddress
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if project token address is zero', async () => {
                await ctx.lib.transferFee(
                    fee,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    0,
                    exchangerAddress,
                    serviceWalletAddress
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if exchanger address is zero', async () => {
                await ctx.lib.transferFee(
                    fee,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    ctx.Token1.address,
                    0,
                    serviceWalletAddress
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if service wallet address is zero', async () => {
                await ctx.lib.transferFee(
                    fee,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    ctx.Token1.address,
                    exchangerAddress,
                    0
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should not send any assets if no fee', async () => {
                await ctx.lib.transferFee(
                    [0, 0],
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    ctx.Token1.address,
                    exchangerAddress,
                    serviceWalletAddress
                );

                (await ctx.Token1.balanceOf(exchangerAddress))
                    .should.bignumber.eq(oneToken.mul(mint));

                (await ctx.Token2.balanceOf(ctx.lib.address))
                    .should.bignumber.eq(oneToken.mul(mint));

                (await web3.eth.getBalance(ctx.lib.address))
                    .should.bignumber.eq(10);
            });
        });
    });

    describe('transferring purchase', () => {
        const oneToken = new BigNumber(10 ** 18);

        beforeEach(async () => {
            ctx.Token1 = await Token.new('1', '1', 18);
            ctx.Token2 = await Token.new('2', '2', 18);
            ctx.Token3 = await Token.new('3', '3', 18);
        });

        describe('pay with token', () => {
            const mint = 1000;
            const invoice = [oneToken, oneToken, 0, oneToken, 0];
            const subCtx = {};

            beforeEach(async () => {
                subCtx.WToken = ctx.Token2;
                subCtx.PaymentToken = ctx.Token3;
                subCtx.contractAddress = ctx.lib.address;
                subCtx.paymentDestinationAddress = ctx.lib.address;
                subCtx.serviceWalletAddress = serviceWalletAddress;
                subCtx.exchangerAddress = exchangerAddress;
                subCtx.investorAddress = investor1Address;
                subCtx.expectedWTokenAmount = invoice[0];
                subCtx.expectedFee = [0, 0];
                subCtx.expectedPaymentTokenAmount = invoice[1];

                await ctx.Token2.mint(ctx.lib.address, oneToken.mul(mint), 0);
                await ctx.Token3.mint(investor1Address, oneToken.mul(mint), 0);

                await ctx.Token3.approve(ctx.lib.address, invoice[1], {from: investor1Address});
                await ctx.Token2.addTrustedAccount(ctx.lib.address);

                ctx.Tx = subCtx.Tx = () => ctx.lib.transferPurchase(
                    invoice,
                    [0, 0],
                    0,
                    web3.fromUtf8('1'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    { from: investor1Address }
                );
            });

            testPurchase.defaultProcess(subCtx);
            testPurchase.whenPaymentWithToken(subCtx);
        });

        describe('pay with eth', () => {
            const mint = 1000;
            const invoice = [oneToken, 10, 0, 10, 0];
            const subCtx = {};

            beforeEach(async () => {
                subCtx.WToken = ctx.Token2;
                subCtx.PaymentToken = ctx.Token3;
                subCtx.contractAddress = ctx.lib.address;
                subCtx.paymentDestinationAddress = ctx.lib.address;
                subCtx.serviceWalletAddress = serviceWalletAddress;
                subCtx.exchangerAddress = exchangerAddress;
                subCtx.investorAddress = investor1Address;
                subCtx.expectedWTokenAmount = invoice[0];
                subCtx.expectedFee = [0, 0];
                subCtx.expectedPaymentETHAmount = invoice[1];

                await ctx.Token2.mint(ctx.lib.address, oneToken.mul(mint), 0);
                await ctx.Token3.mint(investor1Address, oneToken.mul(mint), 0);

                await ctx.Token2.addTrustedAccount(ctx.lib.address);

                ctx.Tx = subCtx.Tx = () => ctx.lib.transferPurchase(
                    invoice,
                    [0, 0],
                    0,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    {from: investor1Address, value: 20}
                );
            });

            testPurchase.defaultProcess(subCtx);
            testPurchase.whenPaymentWithETH(subCtx);
        });

        describe('security and checks', () => {
            const mint = 1000;
            const invoice = [oneToken, 10, 0, 10, 0];

            beforeEach(async () => {
                await ctx.Token2.mint(ctx.lib.address, oneToken.mul(mint), 0);
                await ctx.Token3.mint(investor1Address, oneToken.mul(mint), 0);
                await ctx.Token3.approve(ctx.lib.address, oneToken.mul(mint), { from: investor1Address });
                await ctx.Token2.addTrustedAccount(ctx.lib.address);
            });

            it('should revert if project token address is zero', async () => {
                await ctx.lib.transferPurchase(
                    invoice,
                    [0, 0],
                    0,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    0,
                    {from: investor1Address, value: 20}
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if payment token address is zero', async () => {
                await ctx.lib.transferPurchase(
                    invoice,
                    [0, 0],
                    0,
                    web3.fromUtf8('TOK'),
                    0,
                    ctx.Token2.address,
                    {from: investor1Address}
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if token purchase amount is zero', async () => {
                await ctx.lib.transferPurchase(
                    [0, 10, 1, 0, 1],
                    [0, 0],
                    0,
                    web3.fromUtf8('TOK'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    {from: investor1Address}
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if cost amount is zero', async () => {
                await ctx.lib.transferPurchase(
                    [10, 0, 1, 0, 1],
                    [0, 0],
                    0,
                    web3.fromUtf8('TOK'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    {from: investor1Address}
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if eth not enough', async () => {
                await ctx.lib.transferPurchase(
                    invoice,
                    [0, 0],
                    0,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    {from: investor1Address, value: 1}
                )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if fee greater or equal then token amount', async () => {
                await ctx.lib.transferPurchase(
                    invoice,
                    [invoice[0].plus(1), 0],
                    0,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    {from: investor1Address, value: 1}
                    )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });

            it('should revert if fee greater or equal then cost amount', async () => {
                await ctx.lib.transferPurchase(
                    invoice,
                    [0, invoice[1] + 1],
                    0,
                    web3.fromUtf8('ETH'),
                    ctx.Token3.address,
                    ctx.Token2.address,
                    {from: investor1Address, value: 1}
                    )
                    .should.to.be.rejectedWith(utils.EVMRevert);
            });
        });
    });
});
