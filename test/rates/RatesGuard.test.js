require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const RatesGuard = artifacts.require('RatesGuard');
const RatesMock = artifacts.require('RatesGuard__RatesMock');
const failCase = {
    NO_BEST_SUGGESTION: 0,
    TOO_BIG_DIFF_FROM_PREVIOUSLY_RATE: 1,
    SYMBOLS_MISMATCH: 2,
    CONFIRM_SUGGESTION_FAIL: 3
};
// [0] = rates
// [1] = validationTriggerCondition
// [2] = minSuggestionMatch
// [3] = diffPrevTolerant
// [4] = lockOnFailTimeout
// [5] = diffTolerant
// [6] = expireTimeout
// [7] = suggestors
const expectParameters = async (contract, ...params) => {
    params = params.slice(0);
    const suggestors = params.pop();
    const actual = [
        await contract.rates(),
        await contract.validationTriggerCondition(),
        await contract.minSuggestionMatch(),
        await contract.diffPrevTolerant(),
        await contract.lockOnFailTimeout(),
        await contract.diffTolerant(),
        await contract.expireTimeout()
    ];

    for(const idx in actual) {
        if (utils.common.isBigNumber(actual[idx])) {
            actual[idx].should.bignumber.eq(params[idx])
        } else {
            actual[idx].should.to.equal(params[idx]);
        }
    }

    for(const suggestor of suggestors) {
        const actual = await contract.isSuggestor(suggestor);
        actual.should.to.be.true;
    }
};
const hasConfirmingResultEvent = (logs) => !!logs.find(e => e.event === 'Fail' || e.event === 'SuggestionConfirmed');
const expectSetRatesCallResult = async (Rates, result = {}) => {
    const actualRatesSetCallResult = await Rates._setCallResult();
    const symbol = result.symbol ? utils.common.toBytes32(result.symbol) : utils.ZERO_BYTES32;
    const value = result.value ? result.value : 0;

    actualRatesSetCallResult[0].should.to.equal(symbol);
    actualRatesSetCallResult[1].should.bignumber.equal(value);
};
const setCallResults = async (Rates) => {
    const raw = await Rates._setCallResult();
    return raw[0].map((symbol, index) => ({ symbol: web3.toUtf8(symbol), rate: raw[1][index] }));
};
const expectNoBestSuggestionFail = (logs) => {
    utils.expectEvent.inLogs(logs, 'Fail', {
        failCase: failCase.NO_BEST_SUGGESTION
    });
};
const expectTooBigDiffFail = (logs) => {
    utils.expectEvent.inLogs(logs, 'Fail', {
        failCase: failCase.TOO_BIG_DIFF_FROM_PREVIOUSLY_RATE
    });
};
const expectSymbolsMismatchFail = (logs) => {
    utils.expectEvent.inLogs(logs, 'Fail', {
        failCase: failCase.SYMBOLS_MISMATCH
    });
};
const expectConfirmingFail = (logs) => {
    utils.expectEvent.inLogs(logs, 'Fail', {
        failCase: failCase.CONFIRM_SUGGESTION_FAIL
    });
};
const expectConfirmSuggestionWith = (logs, suggestor) => {
    utils.expectEvent.inLogs(logs, 'SuggestionConfirmed', {
        suggestor
    });
};

contract('RatesGuard', (accounts) => {

    describe('creation', () => {
        const rates = utils.generateRandomAddress();

        it('should create with valid parameters', async () => {
            const suggestor = utils.generateRandomAddress();
            const contract = await RatesGuard.new(
                rates, 2, 1, 0, 0, 0, 0, [suggestor]
            ).should.to.be.fulfilled;
            await expectParameters(contract, rates, 2, 1, 0, 0, 0, 0, []);
        });

        it('should`t create if rates address is zero', async () => {
            await utils.shouldFail.reverting(RatesGuard.new(
                utils.ZERO_ADDRESS, 2, 1, 0, 0, 0, 0, []
            ));
        });

        it('should`t create if the validation trigger condition parameter less then 2', async () => {
            await utils.shouldFail.reverting(RatesGuard.new(
                rates, 1, 1, 0, 0, 0, 0, []
            ));
        });

        it('should`t create if the min suggestion match parameter less then 1', async () => {
            await utils.shouldFail.reverting(RatesGuard.new(
                rates, 2, 0, 0, 0, 0, 0, []
            ));
        });
    });

    describe('parameters', () => {
        let rates = utils.generateRandomAddress();
        const symbol = '1';
        const symbolBytes32 = utils.common.toBytes32(symbol);
        const ctx = {};

        before(async () => {
            ctx.contract = await await RatesGuard.new(
                rates, 2, 1, 0, 0, 0, 0, []
            );
        });

        describe('the rates parameter', () => {
            rates = utils.generateRandomAddress();

            before(async () => {
                ctx.tx = ctx.contract.setRates(rates);
            });

            it('should update parameter', async () => {
                await ctx.tx;
                const actual = await ctx.contract.rates();
                actual.should.to.equal(rates);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.tx,
                    'SettingUpdated',
                    {
                        updater: accounts[0],
                        rates,
                        validationTriggerCondition: 2,
                        minSuggestionMatch: 1,
                        diffPrevTolerant: 0,
                        lockOnFailTimeout: 0,
                        diffTolerant: 0,
                        expireTimeout: 0
                    }
                )
            });
        });

        describe('the validation trigger condition parameter', () => {
            const value = 3;

            it('should update parameter', async () => {
                await ctx.contract.setValidationTriggerCondition(value);
                const actual = await ctx.contract.validationTriggerCondition();
                actual.should.bignumber.equal(value);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.contract.setValidationTriggerCondition(value),
                    'SettingUpdated',
                    {
                        updater: accounts[0],
                        rates,
                        validationTriggerCondition: value,
                        minSuggestionMatch: 1,
                        diffPrevTolerant: 0,
                        lockOnFailTimeout: 0,
                        diffTolerant: 0,
                        expireTimeout: 0
                    }
                )
            });

            it('should revert if value less then 2', async () => {
                await utils.shouldFail.reverting(ctx.contract.setValidationTriggerCondition(1));
            });
        });

        describe('the min suggestions match parameter', () => {
            const value = 3;

            it('should update parameter', async () => {
                await ctx.contract.setMinSuggestionMatch(value);
                const actual = await ctx.contract.minSuggestionMatch();
                actual.should.bignumber.equal(value);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.contract.setMinSuggestionMatch(value),
                    'SettingUpdated',
                    {
                        updater: accounts[0],
                        rates,
                        validationTriggerCondition: 3,
                        minSuggestionMatch: value,
                        diffPrevTolerant: 0,
                        lockOnFailTimeout: 0,
                        diffTolerant: 0,
                        expireTimeout: 0
                    }
                )
            });

            it('should revert if value less then 1', async () => {
                await utils.shouldFail.reverting(ctx.contract.setMinSuggestionMatch(0));
            });
        });

        describe('the diff prev tolerant parameter', () => {
            const value = 3;

            before(async () => {
                ctx.tx = ctx.contract.setDiffPrevTolerant(value);
            });

            it('should update parameter', async () => {
                await ctx.tx;
                const actual = await ctx.contract.diffPrevTolerant();
                actual.should.bignumber.equal(value);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.tx,
                    'SettingUpdated',
                    {
                        updater: accounts[0],
                        rates,
                        validationTriggerCondition: 3,
                        minSuggestionMatch: 3,
                        diffPrevTolerant: value,
                        lockOnFailTimeout: 0,
                        diffTolerant: 0,
                        expireTimeout: 0
                    }
                )
            });
        });

        describe('the lock on fail timeout parameter', () => {
            const value = 3;

            before(async () => {
                ctx.tx = ctx.contract.setLockOnFailTimeout(value);
            });

            it('should update parameter', async () => {
                await ctx.tx;
                const actual = await ctx.contract.lockOnFailTimeout();
                actual.should.bignumber.equal(value);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.tx,
                    'SettingUpdated',
                    {
                        updater: accounts[0],
                        rates,
                        validationTriggerCondition:3,
                        minSuggestionMatch: 3,
                        diffPrevTolerant: 3,
                        lockOnFailTimeout: value,
                        diffTolerant: 0,
                        expireTimeout: 0
                    }
                )
            });
        });

        describe('the diff tolerant parameter', () => {
            const value = 3;

            before(async () => {
                ctx.tx = ctx.contract.setDiffTolerant(value);
            });

            it('should update parameter', async () => {
                await ctx.tx;
                const actual = await ctx.contract.diffTolerant();
                actual.should.bignumber.equal(value);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.tx,
                    'SettingUpdated',
                    {
                        updater: accounts[0],
                        rates,
                        validationTriggerCondition: 3,
                        minSuggestionMatch: 3,
                        diffPrevTolerant: 3,
                        lockOnFailTimeout: 3,
                        diffTolerant: value,
                        expireTimeout: 0
                    }
                )
            });
        });

        describe('the expire timeout parameter', () => {
            const value = 3;

            before(async () => {
                ctx.tx = ctx.contract.setExpireTimeout(value);
            });

            it('should update parameter', async () => {
                await ctx.tx;
                const actual = await ctx.contract.expireTimeout();
                actual.should.bignumber.equal(value);
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.tx,
                    'SettingUpdated',
                    {
                        updater: accounts[0],
                        rates,
                        validationTriggerCondition: 3,
                        minSuggestionMatch: 3,
                        diffPrevTolerant: 3,
                        lockOnFailTimeout: 3,
                        diffTolerant: 3,
                        expireTimeout: value
                    }
                )
            });
        });

        describe('the diff prev tolerant for symbol parameter', () => {
            const value = 3;

            it('should set parameter', async () => {
                await ctx.contract.setDiffPrevTolerantForSymbol(symbolBytes32, value);
                const actual = await ctx.contract.diffPrevTolerantForSymbol(symbolBytes32);
                actual.should.bignumber.equal(value);
                const actualHas = await ctx.contract.hasDiffPrevTolerantForSymbol(symbolBytes32);
                actualHas.should.to.be.true;
            });

            it('should unset parameter', async () => {
                await ctx.contract.unsetDiffPrevTolerantForSymbol(symbolBytes32);
                const actual = await ctx.contract.diffPrevTolerantForSymbol(symbolBytes32);
                actual.should.bignumber.equal(0);
                const actualHas = await ctx.contract.hasDiffPrevTolerantForSymbol(symbolBytes32);
                actualHas.should.to.be.false;
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.contract.setDiffPrevTolerantForSymbol(symbolBytes32, value),
                    'DiffPrevTolerantForSymbolsUpdated',
                    {
                        updater: accounts[0],
                        symbol: symbolBytes32,
                        value
                    }
                );
                await utils.expectEvent.inTransaction(
                    ctx.contract.unsetDiffPrevTolerantForSymbol(symbolBytes32),
                    'DiffPrevTolerantForSymbolsRemoved',
                    {
                        remover: accounts[0],
                        symbol: symbolBytes32
                    }
                );
            });
        });

        describe('the diff tolerant for symbol parameter', () => {
            const value = 3;

            it('should set parameter', async () => {
                await ctx.contract.setDiffTolerantForSymbol(symbolBytes32, value);
                const actual = await ctx.contract.diffTolerantForSymbol(symbolBytes32);
                actual.should.bignumber.equal(value);
                const actualHas = await ctx.contract.hasDiffTolerantForSymbol(symbolBytes32);
                actualHas.should.to.be.true;
            });

            it('should unset parameter', async () => {
                await ctx.contract.unsetDiffTolerantForSymbol(symbolBytes32);
                const actual = await ctx.contract.diffTolerantForSymbol(symbolBytes32);
                actual.should.bignumber.equal(0);
                const actualHas = await ctx.contract.hasDiffTolerantForSymbol(symbolBytes32);
                actualHas.should.to.be.false;
            });

            it('should emit event', async () => {
                await utils.expectEvent.inTransaction(
                    ctx.contract.setDiffTolerantForSymbol(symbolBytes32, value),
                    'DiffTolerantForSymbolsUpdated',
                    {
                        updater: accounts[0],
                        symbol: symbolBytes32,
                        value
                    }
                );
                await utils.expectEvent.inTransaction(
                    ctx.contract.unsetDiffTolerantForSymbol(symbolBytes32),
                    'DiffTolerantForSymbolsRemoved',
                    {
                        remover: accounts[0],
                        symbol: symbolBytes32
                    }
                );
            });
        });
    });

    describe('features', () => {
        const ctx = {};
        const usd = utils.toInternalUSD;
        const symbols1 = ['1', '2'];
        const anotherSymbol = '3';
        const anotherSymbolBytes32 = utils.common.toBytes32(anotherSymbol);
        const symbols1Bytes32 = symbols1.map(utils.common.toBytes32);
        const suggestors = accounts;
        const setCondition = (...params) => async () => {
            ctx.Rates = await RatesMock.new();
            for (const symbol of symbols1Bytes32) {
                await ctx.Rates._hasSymbol(symbol, true);
            }
            await ctx.Rates._hasSymbol(anotherSymbolBytes32, true);
            ctx.contract = await RatesGuard.new(ctx.Rates.address, ...params);
        };
        const setRates = (one, two, three) => async () => {
            await ctx.Rates._get(symbols1Bytes32[0], one);
            await ctx.Rates._get(symbols1Bytes32[1], two);
            await ctx.Rates._get(anotherSymbolBytes32, three);
        };

        before(setCondition(2, 1, 0, 0, 0, 0, suggestors));

        it('should`t run confirmation process if suggestions count lest then requested', async() => {
            const {logs} = await ctx.contract.suggest(
                symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)]);
            hasConfirmingResultEvent(logs).should.to.be.false;
            const actualSetCallResults = await setCallResults(ctx.Rates);
            actualSetCallResults.length.should.to.equal(0);
        });

        it('should`t run confirmation process if a suggestor send one more suggest', async () => {
            const {logs} = await ctx.contract.suggest(
                symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)]);
            hasConfirmingResultEvent(logs).should.to.be.false;
            const actualSetCallResults = await setCallResults(ctx.Rates);
            actualSetCallResults.length.should.to.equal(0);
        });

        it('should run confirmation process if suggestions count match requested', async () => {
            const {logs} = await ctx.contract.suggest(
                symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)], {from: accounts[1]});
            hasConfirmingResultEvent(logs).should.to.be.true;
            const actualSetCallResults = await setCallResults(ctx.Rates);
            actualSetCallResults.length.should.to.equal(2);
            for(const idx in actualSetCallResults) {
                const record = actualSetCallResults[idx];
                const expectedSymbol = symbols1[idx];
                record.symbol.should.to.equal(expectedSymbol);
                record.rate.should.bignumber.equal(utils.toInternalUSD(1));
            }
        });

        it('should clear suggestions and don`t run confirmation process after new added', async () => {
            const {logs} = await ctx.contract.suggest(
                symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)]);
            hasConfirmingResultEvent(logs).should.to.be.false;
            const actualSetCallResults = await setCallResults(ctx.Rates);
            actualSetCallResults.length.should.to.equal(2);
        });

        it('should revert if suggestions symbols list length is not equal rates list length', async () => {
            await utils.shouldFail.reverting(
                ctx.contract.suggest(
                    symbols1Bytes32, [utils.toInternalUSD(1)])
            );
        });

        it('should generate fail event when rates set internal transaction has been failed', async () => {
            await ctx.Rates._setRevertEnabled(true);
            await ctx.contract.suggest(
                symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)], {from: accounts[0]});
            const {logs} = await ctx.contract.suggest(
                symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)], {from: accounts[1]});
            expectConfirmingFail(logs);
            await ctx.Rates._setRevertEnabled(false);
        });

        describe('roles', () => {
            const ctx = {};

            before(async () => {
                ctx.Rates = await RatesMock.new();
                for (const symbol of symbols1Bytes32) {
                    await ctx.Rates._hasSymbol(symbol, true);
                }
                ctx.contract = await RatesGuard.new(ctx.Rates.address, 2, 1, 0, 0, 0, 0, []);
            });

            it('creator should be admin', async () => {
                const actualStatus = await ctx.contract.isAdmin(accounts[0]);
                actualStatus.should.to.be.true;
            });

            it('creator should`t be suggestor', async () => {
                const actualStatus = await ctx.contract.isSuggestor(accounts[0]);
                actualStatus.should.to.be.false;
            });

            it('admin should can add another admin', async () => {
                await ctx.contract.addAdmin(accounts[1]);
                const actualStatus = await ctx.contract.isAdmin(accounts[1]);
                actualStatus.should.to.be.true;
            });

            it('not admin should can`t add another admin', async () => {
                await utils.shouldFail.reverting(
                    ctx.contract.addAdmin(accounts[2], {from: accounts[3]}));
            });

            it('not admin should can`t remove another admin', async () => {
                await utils.shouldFail.reverting(
                    ctx.contract.removeAdmin(accounts[1], {from: accounts[3]}));
            });

            it('admin should can remove another admin', async () => {
                await ctx.contract.removeAdmin(accounts[1]);
                const actualStatus = await ctx.contract.isAdmin(accounts[1]);
                actualStatus.should.to.be.false;
            });

            it('admin should can add a suggestor', async () => {
                await ctx.contract.addSuggestor(accounts[1]);
                const actualStatus = await ctx.contract.isSuggestor(accounts[1]);
                actualStatus.should.to.be.true;
            });

            it('suggestor should can`t add a suggestor or admin', async () => {
                await utils.shouldFail.reverting(
                    ctx.contract.addAdmin(accounts[2], {from: accounts[1]}));
                await utils.shouldFail.reverting(
                    ctx.contract.addSuggestor(accounts[2], {from: accounts[1]}));
            });

            it('admin should can remove a suggestor', async () => {
                await ctx.contract.removeSuggestor(accounts[1]);
                const actualStatus = await ctx.contract.isSuggestor(accounts[1]);
                actualStatus.should.to.be.false;
            });

            it('not suggestor should can`t call `suggest`', async () => {
                await utils.shouldFail.reverting(
                    ctx.contract.suggest(symbols1Bytes32, [usd(1), usd(1)], {from: accounts[1]}));
            });

            it('suggestor should can call `suggest`', async () => {
                await ctx.contract.addSuggestor(accounts[0]);
                await ctx.contract.suggest(symbols1Bytes32, [usd(1), usd(1)])
                    .should.to.be.fulfilled;
            });
        });

        describe('a best suggestion selection', () => {
            beforeEach(setCondition(3, 2, usd(0), 0, usd(0.1), 0, suggestors));
            beforeEach(async () => {
                await ctx.contract.suggest(symbols1Bytes32, [usd(1), usd(1)], { from: suggestors[0] });
                await ctx.contract.suggest(symbols1Bytes32, [usd(1.1), usd(1.1)], { from: suggestors[1] });
            });

            it('should take most recent added suggestion when two or more suggestions has the same matches count', async () => {
                const {logs} = await ctx.contract.suggest(symbols1Bytes32, [usd(1.1), usd(1.1)], {from: suggestors[2]});
                expectConfirmSuggestionWith(logs, suggestors[2]);
            });

            it('should overwrite suggestion for the same suggestor and change selection result', async () => {
                await ctx.contract.suggest(symbols1Bytes32, [usd(0.9), usd(0.9)], {from: suggestors[1]});
                const {logs} = await ctx.contract.suggest(symbols1Bytes32, [usd(1.1), usd(1.1)], {from: suggestors[2]});
                expectConfirmSuggestionWith(logs, suggestors[0]);
            });

            it('should fail if matches count is not equal or less then required', async () => {
                await ctx.contract.suggest(symbols1Bytes32, [usd(0.7), usd(0.7)], {from: suggestors[0]});
                await ctx.contract.suggest(symbols1Bytes32, [usd(0.9), usd(0.9)], {from: suggestors[1]});
                const {logs} = await ctx.contract.suggest(symbols1Bytes32, [usd(1.1), usd(1.1)], {from: suggestors[2]});
                expectNoBestSuggestionFail(logs);
            });

            it('should not select if symbols length of a suggestions is not equal to others suggestions symbols lengths', async () => {
                const symbols = symbols1Bytes32.concat([anotherSymbolBytes32]);
                const {logs} = await ctx.contract.suggest(symbols, [usd(1.1), usd(1.1), usd(1.1)], {from: suggestors[2]});
                expectNoBestSuggestionFail(logs);
            });

            it('should not select if suggestions symbols list has not contains one or more symbols from another suggestions symbols list', async () => {
                const symbols = [symbols1Bytes32[0], anotherSymbolBytes32];
                const {logs} = await ctx.contract.suggest(symbols, [usd(1.1), usd(1.1)], {from: suggestors[2]});
                expectNoBestSuggestionFail(logs);
            });

            it('should not select if rate difference from another suggestion is too big', async () => {
                const {logs} = await ctx.contract.suggest(symbols1Bytes32, [usd(1.2), usd(1.2)], {from: suggestors[2]});
                expectConfirmSuggestionWith(logs, suggestors[1]);
            });

            it('should take individual difference parameters for symbol and change selection result', async () => {
                await ctx.contract.setDiffTolerantForSymbol(symbols1Bytes32[0], usd(0.05));
                await ctx.contract.suggest(symbols1Bytes32, [usd(1.05), usd(1.1)], {from: suggestors[1]});
                const {logs} = await ctx.contract.suggest(symbols1Bytes32, [usd(0.95), usd(1.1)], {from: suggestors[2]});
                expectConfirmSuggestionWith(logs, suggestors[0]);
            });
        });

        describe('suggestions expire', () => {
            const ctx = {};

            before(async () => {
                ctx.Rates = await RatesMock.new();
                for (const symbol of symbols1Bytes32) {
                    await ctx.Rates._hasSymbol(symbol, true);
                }
                await ctx.Rates._hasSymbol(anotherSymbolBytes32, true);
                ctx.contract = await RatesGuard.new(ctx.Rates.address, 2, 1, 0, 0, 0, 30, suggestors);
                await ctx.contract.suggest(symbols1Bytes32, [usd(1), usd(1)]);
                await utils.time.increase(60);
            });

            it('should remove expired suggestion', async () => {
                const {logs} = await ctx.contract.suggest(
                    symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)], { from: suggestors[1] });
                hasConfirmingResultEvent(logs).should.to.be.false;
                const actualSetCallResults = await setCallResults(ctx.Rates);
                actualSetCallResults.length.should.to.equal(0);
            });
        });

        describe('differences from previously confirmed rate', () => {
            const ctx = {};

            beforeEach(async () => {
                ctx.Rates = await RatesMock.new();
                for (const symbol of symbols1Bytes32) {
                    await ctx.Rates._hasSymbol(symbol, true);
                }
                await ctx.Rates._hasSymbol(anotherSymbolBytes32, true);
                ctx.contract = await RatesGuard.new(ctx.Rates.address, 2, 1, usd(0.2), 0, 0, 0, suggestors);
                await ctx.contract.suggest(symbols1Bytes32, [usd(1), usd(1)]);
                await utils.time.increase(60);
            });

            it('should confirm if no previously rate', async () => {
                const {logs} = await ctx.contract.suggest(
                    symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)], {from: suggestors[1]});
                expectConfirmSuggestionWith(logs, suggestors[1]);
            });

            it('should not confirm if there is previously rate and difference from new is to big', async () => {
                await ctx.Rates._get(symbols1Bytes32[0], usd(0.5));
                const {logs} = await ctx.contract.suggest(
                    symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)], {from: suggestors[1]});
                expectTooBigDiffFail(logs);
            });

            it('should take individual difference parameter for symbol and change result', async () => {
                await ctx.Rates._get(symbols1Bytes32[0], usd(0.5));
                await ctx.contract.setDiffPrevTolerantForSymbol(symbols1Bytes32[0], usd(0.5));
                const {logs} = await ctx.contract.suggest(
                    symbols1Bytes32, [utils.toInternalUSD(1), utils.toInternalUSD(1)], {from: suggestors[1]});
                expectConfirmSuggestionWith(logs, suggestors[1]);
            });
        });

        describe('symbols mismatching', () => {
            const ctx = {};
            const symbols = symbols1Bytes32.concat([anotherSymbolBytes32]);
            beforeEach(async () => {
                ctx.Rates = await RatesMock.new();
                for (const symbol of symbols1Bytes32) {
                    await ctx.Rates._hasSymbol(symbol, true);
                }
                ctx.contract = await RatesGuard.new(ctx.Rates.address, 2, 1, 0, 0, 0, 0, suggestors);
                await ctx.contract.suggest(symbols, [usd(1), usd(1), usd(1)]);
                await utils.time.increase(60);
            });

            it('should fail if symbols list of selected suggestion does not match allowed in Rates contract', async () => {
                const {logs} = await ctx.contract.suggest(
                    symbols, [usd(1), usd(1), usd(1)], {from: suggestors[1]});
                expectSymbolsMismatchFail(logs);
            });
        });

        describe('lock', () => {
            const ctx = {};
            const symbols = symbols1Bytes32.concat([anotherSymbolBytes32]);

            beforeEach(async () => {
                ctx.Rates = await RatesMock.new();
                for (const symbol of symbols1Bytes32) {
                    await ctx.Rates._hasSymbol(symbol, true);
                }
                ctx.contract = await RatesGuard.new(ctx.Rates.address, 2, 1, 0, 60, 0, 0, suggestors);
                await ctx.contract.suggest(symbols, [usd(1), usd(1), usd(1)]);
                // generate mismatch symbols fail
                await ctx.contract.suggest(symbols, [usd(1), usd(1), usd(1)], {from: suggestors[1]});
            });

            it('should`t accept suggestions while lock has been enable', async () => {
                await utils.shouldFail.reverting(
                    ctx.contract.suggest(symbols1Bytes32, [usd(1), usd(1)])
                );
            });

            it('should accept suggestion after lock time expired', async () => {
                await utils.time.increase(61);
                await ctx.contract.suggest(symbols1Bytes32, [usd(1), usd(1)])
                    .should.to.be.fulfilled;
            });
        });
    });
})
