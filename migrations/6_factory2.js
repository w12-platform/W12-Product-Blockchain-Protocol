const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12FundFactory = artifacts.require('W12FundFactory');
const Rates = artifacts.require('Rates');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');
const oracles = artifacts.require('OracleBallot');


module.exports = function (deployer, network, accounts) {

    	deployer.then(async () => {



            utils.migrateLog.addAddress(W12FundFactory.contractName, W12FundFactory.address);

            await utils.deploy(network, deployer, W12CrowdsaleFactory, semint.encode(version, 4), W12FundFactory.address, Rates.address);

            utils.migrateLog.addAddress(W12CrowdsaleFactory.contractName, W12CrowdsaleFactory.address);
        });

};
