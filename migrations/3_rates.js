const Rates = artifacts.require('Rates');
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
        });
    }
};
