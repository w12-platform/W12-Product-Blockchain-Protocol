const utils = require('../../shared/tests/utils.js');

const W12FundFactory = artifacts.require('W12FundFactory');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const Percent = artifacts.require('Percent');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const W12Fund = artifacts.require('W12Fund');

async function createW12CrowdsaleViaFabric(
    {
        originTokenAddress,
        serviceWalletAddress,
        swapAddress,
        price,
        serviceFee,
        saleFee,
        trancheFee,
    },
    owner,
    token
) {
    const fundFactory = await W12FundFactory.new(0);
    const factory = await W12CrowdsaleFactory.new(0, fundFactory.address);
    const txParams = {from: owner};
    const txOutput = await factory.createCrowdsale(
        originTokenAddress,
        token.address,
        price,
        serviceWalletAddress,
        serviceFee,
        saleFee,
        trancheFee,
        swapAddress,
        owner,
        txParams
    );

    const crowdsaleCreatedLogEntry = txOutput.logs.filter(l => l.event === 'CrowdsaleCreated')[0];
    const W12CrowdsaleInst = W12Crowdsale.at(crowdsaleCreatedLogEntry.args.crowdsaleAddress);
    const fundAddress = crowdsaleCreatedLogEntry.args.fundAddress;
    const W12FundInst = W12Fund.at(fundAddress);
    const tokenOwner = await token.owner();

    await token.addTrustedAccount(W12CrowdsaleInst.address, {from: tokenOwner});

    return {
        args: {
            wTokenAddress: token.address,
            price,
            serviceWalletAddress,
            serviceFee,
            swapAddress,
            owner,
        },
        owner,
        txParams,
        W12Crowdsale: W12CrowdsaleInst,
        W12Fund: W12FundInst,
        token
    };
}

async function createW12Crowdsale (
    {
        originTokenAddress,
        serviceWalletAddress,
        swapAddress,
        price,
        serviceFee,
        saleFee,
        fundAddress
    },
    owner,
    token
) {
    const txParams = {from: owner};
    // constructor (address _token, uint32 _startDate, uint _price, address _serviceWallet, uint8 _serviceFee, W12Fund _fund)
    const result = await W12Crowdsale.new(
        0,
        originTokenAddress,
        token.address,
        price,
        serviceWalletAddress,
        swapAddress,
        serviceFee,
        saleFee,
        fundAddress,
        txParams
    );

    return {
        args: {
            originTokenAddress,
            serviceWalletAddress,
            swapAddress,
            price,
            serviceFee,
            saleFee,
            fundAddress
        },
        owner,
        txParams,
        W12Crowdsale: result,
        token
    };
}
module.exports = {
    createW12Crowdsale,
    createW12CrowdsaleViaFabric,
}
