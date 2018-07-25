import * as time from '../../openzeppelin-solidity/test/helpers/increaseTime';
import EVMRevert from '../../openzeppelin-solidity/test/helpers/EVMRevert';

function generateRandomAddress () {
    return `0x${crypto.randomBytes(20).toString('hex')}`;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
     calculation parameters:

         a = address(this).balance
         b = totalFunded
         c = buyers[buyer].totalFunded
         d = buyers[buyer].totalBought
         e = wtokensToRefund

     formula:

         ( ( c * (a / b) ) / d ) * e = (refund amount)
 */
function calculateRefundAmount(a, b, c, d, e) {
    a = new BigNumber(a);
    b = new BigNumber(b);
    c = new BigNumber(c);
    d = new BigNumber(d);
    e = new BigNumber(e);

    let result = new BigNumber(0);

    // 1. c * b / a = A_1
    // 2. A_1 * 10 ** 8 / d * e / 10 ** 8

    if (d.gt(0) && a.gt(0)) {
        const allowedFund = round(c.mul(b).div(a));

        result = result.plus(
            round(round(allowedFund.mul(10 ** 8).div(d)).mul(e).div(10 ** 8))
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

module.exports = {
    time,
    EVMRevert,
    ZERO_ADDRESS,
    generateRandomAddress,
    calculateRefundAmount,
    encodeMilestoneParameters,
    getTransactionCost
}
