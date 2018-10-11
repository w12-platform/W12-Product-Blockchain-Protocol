const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const Percent = artifacts.require('Percent');
const Utils = artifacts.require('Utils');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const PurchaseProcessingMock = artifacts.require('PurchaseProcessingMock');
const W12FundFactory = artifacts.require('W12FundFactory');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    deployer.then(async () => {
        await utils.deploy(network, deployer, Percent);
        await utils.deploy(network, deployer, Utils);

        W12CrowdsaleStub.link(Percent);
        W12Crowdsale.link(Percent);
        W12CrowdsaleFactory.link(Percent);

        if (network === 'development') {
            PurchaseProcessingMock.link(Percent);
            PurchaseProcessingMock.link(Utils);
        }
    });

    if(network === 'test') {
    	deployer.then(async () => {
            await utils.deploy(network, deployer, W12FundFactory, semint.encode(version, 4));
    		await utils.deploy(network, deployer, W12CrowdsaleFactory, semint.encode(version, 4), W12FundFactory.address);
        });
    }
};
