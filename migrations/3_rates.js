const Rates = artifacts.require('Rates');
const RatesGuard = artifacts.require('RatesGuard');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    if(network === 'test') {
    	deployer.then(async () => {
    	    if (version === '0.26.0') {
                await utils.deploy(network, deployer, Rates);
            } else {
    	        console.log('skip deploying Rates.sol, deployed address: ', Rates.address);
            }

            if (version === '0.28.0') {
                // requires: 5 suggestors, 4 matches, max 10 usd dif frm prev rate, 1 hour lock, 10 usd rate diff, 3 hour suggestion expire
                await utils.deploy(network, deployer, RatesGuard, Rates.address, 5, 4, 1000000000, 60 * 60 * 1, 1000000000, 60 * 60 * 3, []);
                await (await Rates.deployed()).addPricer(RatesGuard.address);
            } else {
                console.log('skip deploying RatesGuard.sol, deployed address: ', RatesGuard.address);
            }
        });
    }
};
