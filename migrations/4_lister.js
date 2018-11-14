const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12ListerStub = artifacts.require('W12ListerStub');
const W12Lister = artifacts.require('W12Lister');
const Versions = artifacts.require("./versioning/VersionsLedger.sol");
const TokenExchanger = artifacts.require('TokenExchanger');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    if (network === 'test' || network === 'mainnet') {
        deployer.then(async () => {
            const Lister = network === 'test' ? W12ListerStub : W12Lister;
            const owner = accounts[0];
            const serviceWallet = accounts[0];

            await utils.deploy(network, deployer, TokenExchanger, semint.encode(version, 4));

            utils.migrateLog.addAddress(TokenExchanger.contractName, TokenExchanger.address);

            if (network === 'test') {
                await utils.deploy(
                    network,
                    deployer,
                    Lister,
                    semint.encode(version, 4),
                    W12CrowdsaleFactory.address,
                    TokenExchanger.address);
            } else {
                await utils.deploy(
                    network,
                    deployer,
                    Lister,
                    semint.encode(version, 4),
                    serviceWallet,
                    W12CrowdsaleFactory.address,
                    TokenExchanger.address);
            }


            utils.migrateLog.addAddress(W12Lister.contractName, Lister.address);
            utils.migrateLog.addAddress('Owner', owner);
            utils.migrateLog.addAddress('Service wallet', serviceWallet);

            const tokenExchanger = await TokenExchanger.deployed();
            const versions = await Versions.deployed();

            await tokenExchanger.transferOwnership(Lister.address, {
                gas: await tokenExchanger.transferOwnership.estimateGas(Lister.address)
            });
            await versions.setVersion(Lister.address, semint.encode(version, 4), {
                gas: await versions.setVersion.estimateGas(Lister.address, semint.encode(version, 4))
            });
        });
    }
};
