const WToken = artifacts.require('WToken');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const W12CrowdsaleFundStub = artifacts.require('W12CrowdsaleFundStub');
const Rates = artifacts.require('Rates');

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
    mint = new BigNumber(mint);

    const list = [];
    const ten = new BigNumber(10);

    for (const tokenIdx in wtokens) {
        const wtokenDecimals = wtokens[tokenIdx].decimal;
        const wtoken = wtokens[tokenIdx].token;
        const originTokenDecimals = originTokens[tokenIdx].decimal;
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

        const fund = await W12CrowdsaleFundStub.new({from: owner});
        const rates = await Rates.new({from: owner});
        const crowdsale = await W12CrowdsaleStub.new(
            0,
            originToken.address,
            wtoken.address,
            utils.toInternalUSD(price),
            serviceWallet,
            swap,
            utils.toInternalPercent(serviceFee),
            utils.toInternalPercent(saleFee),
            fund.address,
            rates.address,
            {from: owner}
        );
        const wtokenOwner = await wtoken.owner();
        const originTokenOwner = await originToken.owner();

        await wtoken.addTrustedAccount(crowdsale.address, { from: wtokenOwner });
        await wtoken.mint(crowdsale.address, ten.pow(wtokenDecimals).mul(mint), 0, {from: wtokenOwner});
        await originToken.mint(swap, ten.pow(originTokenDecimals).mul(mint), 0, {from: originTokenOwner});
        await originToken.approve(
            crowdsale.address,
            utils.percent(ten.pow(originTokenDecimals).mul(mint),
            utils.toInternalPercent(saleFee)),
            {from: swap}
        );
        await fund.setCrowdsale(crowdsale.address, {from: owner});

        item.fund = fund;
        item.crowdsale = crowdsale;
        item.rates = rates;

        list.push(item);
    }

    return list;
}

module.exports = {
    generateWTokens,
    generateW12CrowdsaleStubWithDifferentToken
}
