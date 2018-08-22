const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12FundFactory = artifacts.require('W12FundFactory');

module.exports = function (deployer, network, accounts) {
    if(network === 'test') {
    	deployer.then(async () => {
            await deployer.deploy(W12FundFactory);
    		await deployer.deploy(W12CrowdsaleFactory, W12FundFactory.address);
        });
    }
};
