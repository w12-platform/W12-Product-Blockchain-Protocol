const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Lister = artifacts.require('W12ListerStub');
const Versions = artifacts.require("VersionsLedger");
const TokenExchanger = artifacts.require('TokenExchanger');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    if (network === 'test') {
        deployer.then(async () => {
            const owner = accounts[0];
            const serviceWallet = accounts[0];

            await utils.deploy(network, deployer, TokenExchanger, semint.encode(version, 4));
            await utils.deploy(
                network,
                deployer,
                W12Lister,
                semint.encode(version, 4),
                W12CrowdsaleFactory.address,
                TokenExchanger.address);

            await (await TokenExchanger.deployed()).transferOwnership(W12Lister.address);
            await (await Versions.deployed()).setVersion(W12Lister.address, semint.encode(version, 4));

            console.log('owner', owner);
            console.log('W12CrowdsaleFactory', W12CrowdsaleFactory.address);
            console.log('W12Lister.serviceWallet', serviceWallet);
            console.log('W12Lister.exchanger', await (await W12Lister.deployed()).exchanger());
        });
    }
};
