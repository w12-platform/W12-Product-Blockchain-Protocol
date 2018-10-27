const Wallets = artifacts.require('Wallets');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12ListerStub = artifacts.require('W12ListerStub');
const W12Lister = artifacts.require('W12Lister');
const Versions = artifacts.require("VersionsLedger");
const TokenExchanger = artifacts.require('TokenExchanger');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    if (network === 'test' || network === 'mainnet') {
        deployer.then(async () => {
            const owner = accounts[0];
            const serviceWallet = accounts[0];
            const Lister = network === 'test' ? W12ListerStub : W12Lister;

            await utils.deploy(network, deployer, TokenExchanger, semint.encode(version, 4));

            utils.migrateLog.addAddress(TokenExchanger.contractName, TokenExchanger.address);

            await utils.deploy(
                network,
                deployer,
                Lister,
                semint.encode(version, 4),
                Wallets.address,
                W12CrowdsaleFactory.address,
                TokenExchanger.address
            );

            utils.migrateLog.addAddress(Lister.contractName, Lister.address);
            utils.migrateLog.addAddress('Owner', owner);
            utils.migrateLog.addAddress('Service wallet', serviceWallet);

            await (await TokenExchanger.deployed()).transferOwnership(Lister.address);
            await (await Versions.deployed()).setVersion(Lister.address, semint.encode(version, 4));
        });
    }
};
