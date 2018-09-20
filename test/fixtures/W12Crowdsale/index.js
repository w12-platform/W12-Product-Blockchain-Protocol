const WToken = artifacts.require('WToken');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const W12Fund = artifacts.require('W12Fund');

const utils = require('../../../shared/tests/utils.js');

async function generateWTokens(decimals, owner) {
    const tokens = [];

    for(const decimal of decimals) {
        const token = await WToken.new(
            `TestToken${decimal}`,
            `TT${decimal}`,
            decimal,
            { from: owner }
        );

        tokens.push({
            token,
            decimal,
            owner
        });
    }

    return tokens;
}

// originTokens, wtokens - should be result of generateWTokens
async function generateW12CrowdsaleStubWithDifferentToken(
    {
        serviceWallet,
        swap,
        price,
        tranchePercent,
        serviceFee,
        saleFee,
        mint
    }, originTokens, wtokens, owner
) {
    const list = [];

    for (const tokenIdx in wtokens) {
        const wtoken = wtokens[tokenIdx].token;
        const originToken = originTokens[tokenIdx].token;
        const item = {
            wtoken,
            originToken,
            args: {
                serviceWallet,
                swap,
                price,
                tranchePercent,
                serviceFee,
                saleFee,
                mint
            }
        };

        const fund = await W12Fund.new(0, utils.toInternalPercent(tranchePercent), {from: owner});
        const crowdsale = await W12CrowdsaleStub.new(
            0,
            originToken.address,
            wtoken.address,
            price,
            serviceWallet,
            swap,
            utils.toInternalPercent(serviceFee),
            utils.toInternalPercent(saleFee),
            fund.address,
            {from: owner}
        );
        const wtokenOwner = await wtoken.owner();

        await wtoken.addTrustedAccount(crowdsale.address, { from: wtokenOwner });
        await wtoken.mint(crowdsale.address, mint, 0, {from: wtokenOwner});
        await originToken.mint(swap, mint, 0, {from: wtokenOwner});
        await originToken.approve(crowdsale.address, mint.mul(saleFee / 100), {from: swap});
        await fund.setCrowdsale(crowdsale.address, {from: owner});

        item.fund = fund;
        item.crowdsale = crowdsale;

        list.push(item);
    }

    return list;
}

module.exports = {
    generateWTokens,
    generateW12CrowdsaleStubWithDifferentToken
}
