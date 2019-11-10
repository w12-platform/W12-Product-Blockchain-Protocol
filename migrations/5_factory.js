const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12FundFactory = artifacts.require('W12FundFactory');
const Rates = artifacts.require('Rates');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');
const oracles = artifacts.require('OracleBallot');


module.exports = function (deployer, network, accounts) {

    	deployer.then(async () => {

    	      // await utils.deploy(network, deployer, oracles);

            await utils.deploy(network, deployer, W12FundFactory, semint.encode(version, 4), Rates.address, Rates.address);

        });

};
