require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');
const crowdsaleFixtures = require('./fixtures/crowdsale.js');

const W12Lister = artifacts.require('W12Lister');
const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const ERC20 = artifacts.require('WToken');
const WToken = artifacts.require('WToken');
const W12Fund = artifacts.require('W12Fund');

function wait(ms) {
    return new Promise(rs => setTimeout(rs, ms));
}


contract('W12Lister', async (accounts) => {
    const listerOwner = accounts[0];
    const testAccount = accounts[0];
    const factoryOwner = accounts[0];
    const erc20TokenOwner = accounts[0];
    const serviceWalletAddress = accounts[0];
    const oneToken = new BigNumber(10).pow(18);
    const mintAmount = oneToken.mul(1000000);
    const forSaleAmount = mintAmount;
    const tokenPrice = new BigNumber(10); // 10 wei
    const currentTime = web3.eth.getBlock('latest').timestamp;
    const crowdsaleStartTime = currentTime + utils.time.duration.minutes(2);

    const _Factory = await W12CrowdsaleFactory.new({ from: factoryOwner }).should.be.fulfilled;
    const _W12Lister = await W12Lister.new(serviceWalletAddress, _Factory.address, { from: listerOwner }).should.be.fulfilled;
    const _ERC20Token = await ERC20.new('TestToken', 'TT', 18, { from: erc20TokenOwner, gas: 90000000 }).should.be.fulfilled;
    const tokenAddress = _ERC20Token.address;
    const listerAddress = _W12Lister.address;
    const factoryAddress = _Factory.address;

    await _ERC20Token.mint(erc20TokenOwner, mintAmount, 0, { from: erc20TokenOwner }).should.be.fulfilled;

    const feePercent = 10;
    const ethFeePercent = 10;

    const ledgerAddress = await _W12Lister.ledger().should.be.fulfilled;
    const swapAddress = await _W12Lister.swap().should.be.fulfilled;

    await _W12Lister.whitelistToken(
        erc20TokenOwner,
        _ERC20Token.address,
        "TestTokenForSale",
        "TTFS",
        18,
        feePercent,
        ethFeePercent,
        { from: listerOwner }
    ).should.be.fulfilled;

    await _ERC20Token.approve(_W12Lister.address, mintAmount, {from: erc20TokenOwner}).should.be.fulfilled;
    await _W12Lister.placeToken(_ERC20Token.address, mintAmount, {from: erc20TokenOwner}).should.be.fulfilled;

    const swapAddressBalance = await _ERC20Token.balanceOf(swapAddress).should.be.fulfilled;
    const serviceWalletBalance = await _ERC20Token.balanceOf(serviceWalletAddress).should.be.fulfilled;

    await _W12Lister.initCrowdsale(
        crowdsaleStartTime,
        _ERC20Token.address,
        forSaleAmount,
        tokenPrice,
        { from: erc20TokenOwner }
    ).should.be.fulfilled;

    const crowdsaleAddress = await _W12Lister.getTokenCrowdsale(_ERC20Token.address).should.be.fulfilled;
    const _W12Crowdsale = W12Crowdsale.at(crowdsaleAddress);
    const discountStages = [
        {
            name: 'Phase 0',
            endDate: crowdsaleStartTime + utils.time.duration.minutes(3),
            vestingTime: 0,
            discount: 10,
            volumeBonuses: [
                {
                    boundary: tokenPrice.mul(10),
                    bonus: BigNumber.Zero
                },
                {
                    boundary: tokenPrice.mul(100),
                    bonus: new BigNumber(10)
                },
                {
                    boundary: tokenPrice.mul(1000),
                    bonus: new BigNumber(15)
                }
            ]
        },
        {
            name: 'Phase 1',
            endDate: crowdsaleStartTime + utils.time.duration.days(10),
            vestingTime: crowdsaleStartTime + utils.time.duration.days(1),
            discount: 15,
            volumeBonuses: [
                {
                    boundary: tokenPrice.mul(10),
                    bonus: BigNumber.Zero
                },
                {
                    boundary: tokenPrice.mul(100),
                    bonus: new BigNumber(10)
                },
                {
                    boundary: tokenPrice.mul(1000),
                    bonus: new BigNumber(15)
                }
            ]
        }
    ];


    await _W12Crowdsale.setStages(
        discountStages.map(s => s.endDate),
        discountStages.map(s => s.discount),
        discountStages.map(s => s.vestingTime),
        {from: erc20TokenOwner}
    ).should.be.fulfilled;

    await _W12Crowdsale.setStageVolumeBonuses(0,
        discountStages[0].volumeBonuses.map(vb => vb.boundary),
        discountStages[0].volumeBonuses.map(vb => vb.bonus),
        { from: erc20TokenOwner }
    ).should.be.fulfilled;

    await _W12Crowdsale.setStageVolumeBonuses(1,
        discountStages[1].volumeBonuses.map(vb => vb.boundary),
        discountStages[1].volumeBonuses.map(vb => vb.bonus),
        { from: erc20TokenOwner }
    ).should.be.fulfilled;

    const milestoneFixtures = await crowdsaleFixtures.setTestMilestones(crowdsaleStartTime, _W12Crowdsale, erc20TokenOwner).should.be.fulfilled;

    await utils.time.increaseTimeTo(crowdsaleStartTime + utils.time.duration.minutes(2));

    // at 0 stage
    await _W12Crowdsale.buyTokens({ from: testAccount, value: tokenPrice.mul(100) }).should.be.fulfilled;

    await utils.time.increaseTimeTo(crowdsaleStartTime + utils.time.duration.minutes(5));

    // at 1 stage
    await _W12Crowdsale.buyTokens({ from: testAccount, value: tokenPrice.mul(200) }).should.be.fulfilled;

    const _WToken = WToken.at(await _W12Crowdsale.token());
    const _W12Fund = W12Fund.at(await _W12Crowdsale.fund());

    let testAccountBalance_WToken = (await _WToken.balanceOf(testAccount));
    const testAccountVBalance_WToken = (await _WToken.vestingBalanceOf(testAccount, 0));
    const testAccountBalance_ERC20 = (await _ERC20Token.balanceOf(testAccount));
    const testAccountBalance_WToken2 = (await _WToken.accountBalance(testAccount));

    await utils.time.increaseTimeTo(milestoneFixtures.milestones[0].withdrawalWindow - utils.time.duration.days(1));

    const testAccountRefund = await _W12Fund.getRefundAmount(testAccountBalance_WToken, { from: testAccount }).should.be.fulfilled;

    // await _WToken.approve(_W12Fund.address, 1, { from: testAccount }).should.be.fulfilled;
    // await _W12Fund.refund(1, { from: testAccount }).should.be.fulfilled;

    testAccountBalance_WToken = (await _WToken.balanceOf(testAccount));

    console.log(
        `listerOwner: ${listerOwner}\n`,
        `factoryOwner: ${factoryOwner}\n`,
        `erc20TokenOwner: ${erc20TokenOwner}\n\n`,

        `serviceWalletAddress: ${serviceWalletAddress}\n`,
        `tokenAddress: ${tokenAddress}\n`,
        `ledgerAddress: ${ledgerAddress}\n`,
        `swapAddress: ${swapAddress}\n`,
        `listerAddress: ${listerAddress}\n`,
        `crowdsaleAddress: ${crowdsaleAddress}\n`,
        `wTokenAddress: ${_WToken.address}\n`,
        `fundAddress: ${_W12Fund.address}\n`,
        `factoryAddress: ${factoryAddress}\n\n`,

        `currentTime: ${web3.eth.getBlock('latest').timestamp}\n`,
        `crowdsaleStartTime: ${crowdsaleStartTime}\n`,
        `swapAddressBalance: ${swapAddressBalance.toString()}\n`,
        `serviceWalletBalance: ${serviceWalletBalance.toString()}\n`,
        `testAccountBalance_WToken: ${testAccountBalance_WToken}\n`,
        `testAccountVBalance_WToken: ${testAccountVBalance_WToken}\n`,
        `testAccountBalance_ERC20: ${testAccountBalance_ERC20}\n`,
        `testAccountBalance_WToken2: ${testAccountBalance_WToken2}\n`,
        `testAccountRefund: ${testAccountRefund}\n`,
    );
});
