const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const Percent = artifacts.require('Percent');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12FundFactory = artifacts.require('W12FundFactory');

module.exports = function (deployer, network, accounts) {
    deployer.then(async () => {
        await deployer.deploy(Percent);

        W12CrowdsaleStub.link(Percent);
        W12Crowdsale.link(Percent);
        W12CrowdsaleFactory.link(Percent);
    });

    if(network === 'test') {
    	deployer.then(async () => {
            await deployer.deploy(W12FundFactory);
    		await deployer.deploy(W12CrowdsaleFactory, W12FundFactory.address);
        });
    }
};
