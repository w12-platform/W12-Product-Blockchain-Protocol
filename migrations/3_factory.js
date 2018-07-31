const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');

module.exports = function (deployer, network, accounts) {
    if(network === 'test') {
        deployer.deploy(W12CrowdsaleFactory);
    }
};
