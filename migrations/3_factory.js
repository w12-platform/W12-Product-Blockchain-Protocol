const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const Percent = artifacts.require('Percent');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12FundFactory = artifacts.require('W12FundFactory');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    deployer.then(async () => {
        await deployer.deploy(Percent);
        // https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
        await utils.wait(10000);

        W12CrowdsaleStub.link(Percent);
        W12Crowdsale.link(Percent);
        W12CrowdsaleFactory.link(Percent);
    });

    if(network === 'test') {
    	deployer.then(async () => {
            await deployer.deploy(W12FundFactory, semint.encode(version, 4));
            // https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
            await utils.wait(10000);
    		await deployer.deploy(W12CrowdsaleFactory, semint.encode(version, 4), W12FundFactory.address);
            // https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
            await utils.wait(10000);
        });
    }
};
