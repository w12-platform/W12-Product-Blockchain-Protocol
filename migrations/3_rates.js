const Rates = artifacts.require('Rates');
const RatesGuard = artifacts.require('RatesGuard');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    if(network === 'mainnet' || network === 'test') {
    	deployer.then(async () => {
    	    if (version === '0.29.1') {
                await utils.deploy(network, deployer, Rates);
            } else {
    	        console.log('skip deploying Rates.sol, deployed address: ', Rates.address);
            }

            utils.migrateLog.addAddress(Rates.contractName, Rates.address);

            if (version === '0.29.1') {
                await utils.deploy(network, deployer, RatesGuard,
                    // destination to send suggestion
                    Rates.address,
                    // min suggesters count
                    5,
                    // min suggestions to trigger validation
                    4,
                    // allowed previous rate diff, USD
                    1000000000,
                    // lock time is sec.
                    60 * 10,
                    // allowed rate diff
                    1000000000,
                    // suggestion expiration time
                    60 * 60 * 3,
                    // suggesters list
                    [accounts[0]]
                );
                await (await Rates.deployed()).addPricer(RatesGuard.address);
            } else {
                console.log('skip deploying RatesGuard.sol, deployed address: ', RatesGuard.address);
            }

            utils.migrateLog.addAddress(RatesGuard.contractName, RatesGuard.address);
        });
    }
};
