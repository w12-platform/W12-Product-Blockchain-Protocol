const utils = require('../../shared/tests/utils.js');

const W12FundFactory = artifacts.require('W12FundFactory');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12Fund = artifacts.require('W12Fund');


async function setTestStages (startDate, W12Crowdsale, owner) {
    const discountStages = [
        {
            name: 'Stage 1',
            dates: [
                startDate + utils.time.duration.minutes(40),
                startDate + utils.time.duration.minutes(60),
            ],
            vestingTime: 0,
            discount: 0
        },
        {
            name: 'Stage 2',
            dates: [
                startDate + utils.time.duration.minutes(80),
                startDate + utils.time.duration.minutes(100),
            ],
            discount: 5
        },
        {
            name: 'Stage 3',
            dates: [
                startDate + utils.time.duration.minutes(120),
                startDate + utils.time.duration.minutes(140),
            ],
            vestingTime: startDate + utils.time.duration.minutes(180),
            discount: 10
        }
    ];

    await W12Crowdsale.setStages(
        discountStages.map(s => s.dates),
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
    const fundFactory = await W12FundFactory.new();
    const factory = await W12CrowdsaleFactory.new(fundFactory.address);
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
        originTokenAddress,
        token.address,
        await token.decimals(),
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

async function setTestMilestones(startDate, W12Crowdsale, owner) {
    const expMils = [
        {
            name: "Milestone 1 name",
            description: "Milestone 2 description",
            endDate: startDate + utils.time.duration.days(10),
            tranchePercent: 30,
            voteEndDate: startDate + utils.time.duration.days(17),
            withdrawalWindow: startDate + utils.time.duration.days(20)
        },
        {
            name: "Milestone 2 name",
            description: "Milestone 2 description",
            endDate: startDate + utils.time.duration.days(21),
            tranchePercent: 35,
            voteEndDate: startDate + utils.time.duration.days(27),
            withdrawalWindow: startDate + utils.time.duration.days(30)
        },
        {
            name: "Milestone 3 name",
            description: "Milestone 3 description",
            endDate: startDate + utils.time.duration.days(31),
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
