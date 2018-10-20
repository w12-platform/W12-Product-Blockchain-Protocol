import * as time from 'openzeppelin-solidity/test/helpers/increaseTime';
import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert';
import * as expectEvent from 'openzeppelin-solidity/test/helpers/expectEvent';

function generateRandomAddress () {
    return `0x${crypto.randomBytes(20).toString('hex')}`;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_TOKEN_18 = new BigNumber(10).pow(18);

/**
     calculation parameters:

         a = address(this).balance
         b = totalFunded
         c = buyers[buyer].totalFunded
         d = buyers[buyer].totalBought
         e = wtokensToRefund
         f = token decimals

     formula:

         ( ( c * (a / b) ) / d ) * e = (refund amount)
 */
function calculateRefundAmount(a, b, c, d, e, f) {
    a = new BigNumber(a);
    b = new BigNumber(b);
    c = new BigNumber(c);
    d = new BigNumber(d);
    e = new BigNumber(e);
    f = new BigNumber(f);

    const p_com = (new BigNumber(10)).pow(f.plus(8));
    const max = BigNumber.UINT_MAX.div(p_com);

    let result = new BigNumber(0);

    // 1. c * b / a = A_1
    // 2. A_1 * 10 ** 8 / d * e / 10 ** 8

    if (d.gt(0) && a.gt(0)) {
        const allowedFund = round(c.mul(b).div(a));
        const p = allowedFund.lte(max) ? p_com : 1;

        result = result.plus(
            round(round(allowedFund.mul(p).div(d)).mul(e).div(p))
        );
    }

    return result;
}

function round(number) {
    number = new BigNumber(number);

    return new BigNumber(number.toFixed(0, 1));
}

function encodeMilestoneParameters(
    name,
    description,
    tranchePercent,
    endDate,
    voteEndDate,
    withdrawalWindow
) {
    const result = {
        dates: [
            endDate, voteEndDate, withdrawalWindow
        ],
        tranchePercent,
        offsets: [],
        namesAndDescriptions: '0x',
        descriptionHex: null,
        nameHex: null
    };

    let utfBytes = bytes(name).map(num => num.toString(16)).join('');

    result.offsets.push(utfBytes.length / 2);
    result.namesAndDescriptions += utfBytes;
    result.nameHex = `0x${utfBytes}`;

    utfBytes = bytes(description).map(num => num.toString(16)).join('');

    result.offsets.push(utfBytes.length / 2);
    result.namesAndDescriptions += utfBytes;
    result.descriptionHex = `0x${utfBytes}`;

    return result;
}

async function getTransactionCost(txOutput) {
    const gasUsed = txOutput.receipt.gasUsed;
    const transaction = await web3.eth.getTransaction(txOutput.tx);
    const gasPrice = transaction.gasPrice;

    return gasPrice.mul(gasUsed);
}

function toInternalUSD(usd) {
    usd = new BigNumber(usd);
    return usd.mul(10 ** 8);
}

function fromInternalUSD (usd) {
    usd = new BigNumber(usd);
    return usd.div(10 ** 8);
}

function safeConversionByRate(value, decimals, rate) {
    const ten = new BigNumber(10);
    value = new BigNumber(value);
    decimals = new BigNumber(decimals);
    rate = new BigNumber(rate);

    return round(value.div(ten.pow(decimals)))
        .mul(rate)
        .add(
            round(value
                .mod(ten.pow(decimals))
                .mul(rate)
                .div(ten.pow(decimals)))
        );
}

function safeReverseConversionByRate(value, decimals, rate) {
    const ten = new BigNumber(10);
    value = new BigNumber(value);
    decimals = new BigNumber(decimals);
    rate = new BigNumber(rate);

    return round(value.div(rate)).mul(ten.pow(decimals)).add(round(value.mod(rate).mul(ten.pow(decimals)).div(rate)));
}

function calculatePurchase(
    method,
    paymentAmount,
    stageDiscount,
    volumeBoundaries,
    volumeBonuses,
    methodAmountPriceUSD,
    tokenPriceUSD,
    tokenDecimals,
    methodDecimals,
    currentBalanceInTokens
) {
    paymentAmount = new BigNumber(paymentAmount);
    stageDiscount = new BigNumber(stageDiscount);
    methodAmountPriceUSD = new BigNumber(methodAmountPriceUSD);
    tokenPriceUSD = new BigNumber(tokenPriceUSD);
    tokenDecimals = new BigNumber(tokenDecimals);
    methodDecimals = new BigNumber(methodDecimals);
    currentBalanceInTokens = new BigNumber(currentBalanceInTokens);

    const ten = new BigNumber(10);
    const oneHundredPercent = new BigNumber(toInternalPercent(100));

    let result = {
        tokenAmount: new BigNumber(0),
        cost: new BigNumber(0),
        costUSD: new BigNumber(0),
        change: new BigNumber(0),
        actualTokenPriceUSD: new BigNumber(0)
    };

    result.costUSD = safeConversionByRate(paymentAmount, methodDecimals, methodAmountPriceUSD);

    const volumeBonus = getPurchaseBonus(result.costUSD, volumeBoundaries, volumeBonuses);

    result.actualTokenPriceUSD = stageDiscount.gt(0)
        ? percent(tokenPriceUSD, oneHundredPercent.sub(stageDiscount))
        : tokenPriceUSD;

    result.tokenAmount = safeReverseConversionByRate(
        percent(result.costUSD, oneHundredPercent.add(volumeBonus)),
        tokenDecimals,
        result.actualTokenPriceUSD
    );

    if (currentBalanceInTokens.lt(result.tokenAmount)) {
        result.costUSD = safeConversionByRate(currentBalanceInTokens, tokenDecimals, result.actualTokenPriceUSD);
        result.tokenAmount = currentBalanceInTokens;
    }

    result.cost = safeReverseConversionByRate(result.costUSD, methodDecimals, methodAmountPriceUSD);

    if (result.cost.eq(0) || result.tokenAmount.eq(0)) {
        result.tokenAmount = new BigNumber(0);
        result.cost = new BigNumber(0);
        result.costUSD = new BigNumber(0);
    }

    result.change = paymentAmount.sub(result.cost);

    return result;
}

function getPurchaseBonus(value, volumeBoundaries, volumeBonuses) {
    volumeBoundaries = Array.isArray(volumeBoundaries) ? volumeBoundaries : [];
    volumeBonuses = Array.isArray(volumeBonuses) ? volumeBonuses : [];

    let bonus = new BigNumber(0);

    for (let i = 0; i < volumeBoundaries.length; i++) {
        if (value >= volumeBoundaries[i]) {
            bonus = volumeBonuses[i];
        } else {
            break;
        }
    }

    return bonus;
}

// negative means the investor has paid less
function getPurchaseRoundLoss(tokenAmount, cost, methodAmountPriceUSD, tokenPriceUSD, tokenDecimal, methodDecimal) {
    tokenAmount = new BigNumber(tokenAmount);
    cost = new BigNumber(cost);
    methodAmountPriceUSD = new BigNumber(methodAmountPriceUSD);
    tokenPriceUSD = new BigNumber(tokenPriceUSD);

    const ten = new BigNumber(10);

    return fromInternalUSD(
        cost
            .mul(methodAmountPriceUSD).div(ten.pow(methodDecimal))
            .sub(tokenAmount.mul(tokenPriceUSD).div(ten.pow(tokenDecimal)))
    );
}

function toInternalPercent(percent) {
    return Math.floor(percent * 100);
}

function fromInternalPercent (percent) {
    return percent / 100;
}

function percent(val, percent) {
    val = new BigNumber(val);

    return round(
        val.mul(percent).div(10000)
    );
}

function packSetupCrowdsaleParameters(stages, milestones, paymentMethods) {
    const [pack1, pack2] = stages.reduce((result, stage, idx) => {
        const pack1 = [...stage.dates, stage.discount, stage.vestingTime];

        if (stage.volumeBonuses.length === 0) {
            pack1.push(0, 0);
        } else {
            const lastOffset = result[1].length;

            pack1.push(lastOffset, lastOffset + stage.volumeBonuses.length * 2);
            result[1].push(...stage.volumeBonuses.reduce((result, v, idx) => (result.push(stage.volumeBoundaries[idx], v), result), []));
        }

        result[0].push(pack1);

        return result;
    }, [[], []]);
    const [pack3, pack4, pack5] = milestones
        .map(m =>
            encodeMilestoneParameters(
                m.name,
                m.description,
                m.tranchePercent,
                m.endDate,
                m.voteEndDate,
                m.withdrawalWindow
            )
        )
        .reduce((result, m, idx) => {
            result[0].push([...m.dates, m.tranchePercent]);
            result[1].push(...m.offsets);
            result[2] += m.namesAndDescriptions.slice(2);

            return result;
        }, [[], [], '0x']);

    return [pack1, pack2, pack3, pack4, pack5, paymentMethods];
}

function createStagesGenerator(defaults) {
    defaults = Object.assign({discount: toInternalPercent(0), vestingTime: 0, volumeBonuses: [], volumeBoundaries: []}, defaults);

    return (params => {
        return Array.isArray(params)
            ? params.map(i => Object.assign({}, defaults, i))
            : [Object.assign({}, defaults, params)];
    });
}

function createMilestonesGenerator (defaults) {
    defaults = Object.assign({ name: "Milestone", description: "Milestone" }, defaults);

    return (params => {
        const ln = params && params.length;
        let percentPerItem = !!ln
            ? Math.floor(100 / ln)
            : 100;
        const add = !!ln
            ? percentPerItem * ln === 100
                ? 0
                : 100 - percentPerItem * ln
            : 0;

        return Array.isArray(params)
            ? params.map((i, idx) =>  {
                return Object.assign({}, defaults,{
                    tranchePercent: idx === ln - 1
                        ? toInternalPercent(percentPerItem + add)
                        : toInternalPercent(percentPerItem)
                }, i || {})
            })
            : [Object.assign({}, defaults, { tranchePercent: toInternalPercent(percentPerItem) }, params || {})];
    });
}

module.exports = {
    time,
    expectEvent,
    round,
    EVMRevert,
    ZERO_ADDRESS,
    ONE_TOKEN_18,
    generateRandomAddress,
    calculateRefundAmount,
    encodeMilestoneParameters,
    getTransactionCost,
    calculatePurchase,
    toInternalPercent,
    percent,
    fromInternalPercent,
    packSetupCrowdsaleParameters,
    createStagesGenerator,
    createMilestonesGenerator,
    toInternalUSD,
    fromInternalUSD,
    getPurchaseRoundLoss,
    getPurchaseBonus,
    saveConvertByRate: safeConversionByRate,
    saveReconvertByRate: safeReverseConversionByRate
}
