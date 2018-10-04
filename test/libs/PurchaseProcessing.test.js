require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const PurchaseProcessingMock = artifacts.require('PurchaseProcessingMock');

contract('PurchaseProcessing', () => {
    const ctx = {};

    beforeEach(async () => {
        ctx.lib = await PurchaseProcessingMock.new();
    });

    describe('checkInvoiceInput', () => {

        describe('correct arguments', () => {

            beforeEach(async () => {
                ctx.Tx = ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 1, 1, 0, 18, {value: 1});
            });

            it('should`t revert', async () => {
                await ctx.Tx
                    .should.to.be.fulfilled;
            });

            it('should check result to be true', async () => {
                await ctx.Tx;

                const actual = await ctx.lib._checkInvoiceInputCallResult();

                actual.should.to.be.true;
            });
        });

        describe('incorrect arguments', () => {

            it('should to be false for `paymentAmount`', async () => {
                await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 0, 1, 1, 1, 0, 18, {value: 1});

                const actual = await ctx.lib._checkInvoiceInputCallResult();

                actual.should.to.be.false;
            });

            it('should to be false for `methodUSDRate`', async () => {
                await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 0, 1, 1, 0, 18, {value: 1});

                const actual = await ctx.lib._checkInvoiceInputCallResult();

                actual.should.to.be.false;
            });

            it('should to be false for `tokenUSDRate`', async () => {
                await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 0, 1, 0, 18, {value: 1});

                const actual = await ctx.lib._checkInvoiceInputCallResult();

                actual.should.to.be.false;
            });

            it('should to be false for `currentBalanceInTokens`', async () => {
                await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 1, 0, 0, 18, {value: 1});

                const actual = await ctx.lib._checkInvoiceInputCallResult();

                actual.should.to.be.false;
            });

            it('should to be false for `msg.value`', async () => {
                await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 1, 1, 0, 18, {value: 0});

                const actual = await ctx.lib._checkInvoiceInputCallResult();

                actual.should.to.be.false;
            });

            it('should to be false for `methodDecimal`', async () => {
                await ctx.lib.checkInvoiceInput(web3.fromUtf8('ETH'), 1, 1, 1, 1, 0, 0, {value: 1});

                const actual = await ctx.lib._checkInvoiceInputCallResult();

                actual.should.to.be.false;
            });
        });
    });

    // bytes32 method,
    //         uint paymentAmount,
    //         uint discount,
    //         uint[] volumeBoundaries,
    //         uint[] volumeBonuses,
    //         uint methodUSDRate,
    //         uint tokenUSDRate,
    //         uint tokenDecimals,
    //         uint methodDecimals,
    //         uint currentBalanceInTokens
    // [tokenAmount, cost, costUSD, change, actualTokenPriceUSD]
    describe('invoice', () => {

        describe('should work', () => {

            beforeEach(async () => {
                ctx.Tx = ctx.lib.invoice(web3.fromUtf8('ETH'), 1, 0, [], [], web3.toWei(1, 'ether'), 1, 0, 18, 1, {value: 1});
            });

            it('should`t revert', async () => {
                await ctx.Tx
                    .should.to.be.fulfilled;
            });

            it('should produce correct result', async () => {
                await ctx.Tx;

                const actual = await ctx.lib._invoiceCallResult();

                actual[0].should.bignumber.eq(1);
                actual[1].should.bignumber.eq(1);
                actual[2].should.bignumber.eq(1);
                actual[3].should.bignumber.eq(0);
                actual[4].should.bignumber.eq(1);
            });
        });

        describe('calculation with different values', () => {
            const ten = new BigNumber(10);
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
            ];

            for (const index in _arguments) {
                it(`should work for case #${index}`, async () => {
                    const expected = utils.calculatePurchase(..._arguments[index]);

                    await ctx.lib.invoice(..._arguments[index]);

                    const actual = await ctx.lib._invoiceCallResult();

                    actual[0].should.bignumber.eq(expected.tokenAmount);
                    actual[1].should.bignumber.eq(expected.cost);
                    actual[2].should.bignumber.eq(expected.costUSD);
                    actual[3].should.bignumber.eq(expected.change);
                    actual[4].should.bignumber.eq(expected.actualTokenPriceUSD);

                    console.log(
                        `round loss for set #${index} is `,
                        utils.getPurchaseRoundLoss(
                            actual[0], actual[1],
                            _arguments[index][5], _arguments[index][6],
                            _arguments[index][7], _arguments[index][8]
                        ).toString(), ' USD'
                    );
                });
            }
        });
    });
});
