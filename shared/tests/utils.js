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

function calculatePurchase(weiAmountPaid, weiBasePrice, stageDiscount, volumeBonus, decimals = 18) {
    weiAmountPaid = new BigNumber(weiAmountPaid);
    weiBasePrice = new BigNumber(weiBasePrice);

    let result;

    result = round(
        weiBasePrice
            .mul(new BigNumber(toInternalPercent(100)).minus(stageDiscount))
            .div(toInternalPercent(100))
    )
    result = round(
        weiAmountPaid
            .mul(volumeBonus.plus(toInternalPercent(100)))
            .div(result)
    );
    result = round(
        result
            .mul(new BigNumber(10).pow(decimals))
            .div(toInternalPercent(100))
    );

    return result;
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

function packSetupCrowdsaleParameters(stages, milestones) {
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

    return [pack1, pack2, pack3, pack4, pack5];
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
    createMilestonesGenerator
}
