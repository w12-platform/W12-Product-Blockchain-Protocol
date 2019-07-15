const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12FundFactory = artifacts.require('W12FundFactory');
const Rates = artifacts.require('Rates');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    if(network === 'test' || network === 'mainnet') {
    	deployer.then(async () => {
            await utils.deploy(network, deployer, W12FundFactory, semint.encode(version, 4), Rates.address);

            utils.migrateLog.addAddress(W12FundFactory.contractName, W12FundFactory.address);

            await utils.deploy(network, deployer, W12CrowdsaleFactory, semint.encode(version, 4), W12FundFactory.address, Rates.address);

            utils.migrateLog.addAddress(W12CrowdsaleFactory.contractName, W12CrowdsaleFactory.address);
        });
    }
};
