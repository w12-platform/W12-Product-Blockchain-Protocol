const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const Percent = artifacts.require('Percent');
const Utils = artifacts.require('Utils');
const UtilsMock = artifacts.require('UtilsMock');
const FundAccount = artifacts.require('FundAccount');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const PurchaseProcessingMock = artifacts.require('PurchaseProcessingMock');
const W12FundFactory = artifacts.require('W12FundFactory');
const W12Fund = artifacts.require('W12Fund');
const Rates = artifacts.require('Rates');
const W12FundStub = artifacts.require('W12FundStub');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    deployer.then(async () => {
        await utils.deploy(network, deployer, Percent);
        await utils.deploy(network, deployer, Utils);
        await utils.deploy(network, deployer, FundAccount);

        if (network === 'test' || network === 'mainnet') {
            utils.migrateLog.addAddress(Percent.contractName, Percent.address);
        }

        W12CrowdsaleStub.link(Percent);
        W12CrowdsaleStub.link(Utils);
        W12Crowdsale.link(Percent);
        W12Crowdsale.link(Utils);
        W12CrowdsaleFactory.link(Percent);
        W12CrowdsaleFactory.link(Utils);
        W12FundFactory.link(FundAccount);
        W12Fund.link(FundAccount);

        if (network === 'development') {
            W12FundStub.link(FundAccount);
            PurchaseProcessingMock.link(Percent);
            PurchaseProcessingMock.link(Utils);
            UtilsMock.link(Utils);
        }
    });

    if(network === 'test' || network === 'mainnet') {
    	deployer.then(async () => {
            await utils.deploy(network, deployer, W12FundFactory, semint.encode(version, 4), Rates.address);

            utils.migrateLog.addAddress(W12FundFactory.contractName, W12FundFactory.address);

            await utils.deploy(network, deployer, W12CrowdsaleFactory, semint.encode(version, 4), W12FundFactory.address, Rates.address);

            utils.migrateLog.addAddress(W12CrowdsaleFactory.contractName, W12CrowdsaleFactory.address);
        });
    }
};
