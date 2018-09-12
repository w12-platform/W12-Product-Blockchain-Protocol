import * as time from '../../openzeppelin-solidity/test/helpers/increaseTime';
import EVMRevert from '../../openzeppelin-solidity/test/helpers/EVMRevert';
import * as expectEvent from '../../openzeppelin-solidity/test/helpers/expectEvent';

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
    if (percent < 0 || percent > 100) throw new RangeError('percent is not in allowed range');

    return Math.floor(percent * 100);
}

function fromInternalPercent (percent) {
    if (percent < 0 || percent > 10000) throw new RangeError('percent is not in allowed range');

    return percent / 100;
}

function percent(val, percent) {
    val = new BigNumber(val);

    return round(
        val.mul(percent).div(10000)
    );
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
    fromInternalPercent
}
