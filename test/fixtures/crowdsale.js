const utils = require('../../shared/tests/utils.js');

const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12Fund = artifacts.require('W12Fund');
const WToken = artifacts.require('WToken');


async function setTestStages (startDate, W12Crowdsale, owner) {
    const discountStages = [
        {
            name: 'Phase 0',
            endDate: startDate + utils.time.duration.minutes(60),
            vestingTime: 0,
            discount: 0
        },
        {
            name: 'Phase 5',
            endDate: startDate + utils.time.duration.minutes(90),
            vestingTime: startDate + utils.time.duration.minutes(210),
            discount: 5
        },
        {
            name: 'Phase 10',
            endDate: startDate + utils.time.duration.minutes(120),
            vestingTime: startDate + utils.time.duration.minutes(180),
            discount: 10
        }
    ];

    await W12Crowdsale.setStages(
        discountStages.map(s => s.endDate),
        discountStages.map(s => s.discount),
        discountStages.map(s => s.vestingTime),
        {from: owner}
    );

    return {
        stages: discountStages,
        startDate,
        W12Crowdsale,
        owner,
        txParams: {from: owner}
    };
}

async function createW12CrowdsaleViaFabric(
    {
        startDate,
        serviceWalletAddress,
        swapAddress,
        price,
        serviceFee
    },
    owner,
    token
) {
    const factory = await W12CrowdsaleFactory.new();
    const txParams = {from: owner};
    const txOutput = await factory.createCrowdsale(
        token.address,
        startDate,
        price,
        serviceWalletAddress,
        serviceFee,
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
            startDate,
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
        startDate,
        serviceWalletAddress,
        swapAddress,
        price,
        serviceFee,
        fundAddress
    },
    owner,
    token
) {
    const txParams = {from: owner};
    // constructor (address _token, uint32 _startDate, uint _price, address _serviceWallet, uint8 _serviceFee, W12Fund _fund)
    const result = await W12Crowdsale.new(
        token.address,
        startDate,
        price,
        serviceWalletAddress,
        serviceFee,
        fundAddress,
        txParams
    );

    return {
        args: {
            startDate,
            serviceWalletAddress,
            swapAddress,
            price,
            serviceFee,
            fundAddress
        },
        owner,
        txParams,
        W12Crowdsale: result,
        token
    };
}

async function setTestMilestones(startDate, W12Crowdsale, owner) {
    const expMils = [
        {
            name: "Milestone 1 name",
            description: "Milestone 2 description",
            endDate: startDate + utils.time.duration.days(10),
            tranchePercent: 25,
            voteEndDate: startDate + utils.time.duration.days(17),
            withdrawalWindow: startDate + utils.time.duration.days(20)
        },
        {
            name: "Milestone 2 name",
            description: "Milestone 2 description",
            endDate: startDate + utils.time.duration.days(20),
            tranchePercent: 35,
            voteEndDate: startDate + utils.time.duration.days(27),
            withdrawalWindow: startDate + utils.time.duration.days(30)
        },
        {
            name: "Milestone 3 name",
            description: "Milestone 3 description",
            endDate: startDate + utils.time.duration.days(30),
            tranchePercent: 35,
            voteEndDate: startDate + utils.time.duration.days(37),
            withdrawalWindow: startDate + utils.time.duration.days(40)
        }
    ];

    const encodedMils = expMils.map(item => {
        return utils.encodeMilestoneParameters(
            item.name,
            item.description,
            item.tranchePercent,
            item.endDate,
            item.voteEndDate,
            item.withdrawalWindow
        );
    });

    await W12Crowdsale.setMilestones(
        encodedMils.reduce((result, item) => result.concat(item.dates), []),
        encodedMils.map(m => m.tranchePercent),
        encodedMils.reduce((result, item) => result.concat(item.offsets), []),
        encodedMils.reduce((result, item) => (result + item.namesAndDescriptions.slice(2)), '0x'),
        {from: owner}
    );

    return {
        startDate,
        milestones: expMils,
        encoded: encodedMils,
        W12Crowdsale,
        owner,
        txParams: { from: owner }
    };
}

module.exports = {
    setTestStages,
    createW12Crowdsale,
    createW12CrowdsaleViaFabric,
    setTestMilestones
}
