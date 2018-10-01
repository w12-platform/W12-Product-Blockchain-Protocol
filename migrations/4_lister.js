const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Lister = artifacts.require('W12ListerStub');
const Versions = artifacts.require("./versioning/VersionsLedger.sol");
const W12AtomicSwap = artifacts.require('W12AtomicSwap');
const W12TokenLedger = artifacts.require('W12TokenLedger');
const version = require('../package').version;
const semint = require('@redtea/semint');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
    if (network === 'test') {
        deployer.then(async () => {
            const owner = accounts[0];
            const serviceWallet = accounts[0];

            await utils.deploy(deployer, W12TokenLedger, semint.encode(version, 4));
            await utils.deploy(deployer, W12AtomicSwap, semint.encode(version, 4), W12TokenLedger.address);
            await utils.deploy(deployer, W12Lister, semint.encode(version, 4), W12CrowdsaleFactory.address, W12TokenLedger.address, W12AtomicSwap.address);

            await (await W12TokenLedger.deployed()).transferOwnership(W12Lister.address);
            await (await W12AtomicSwap.deployed()).transferOwnership(W12Lister.address);
            await (await Versions.deployed()).setVersion(W12Lister.address, semint.encode(version, 4));

            console.log('owner', owner);
            console.log('W12CrowdsaleFactory', W12CrowdsaleFactory.address);
            console.log('W12Lister.serviceWallet', serviceWallet);
            console.log('W12Lister.ledger', await (await W12Lister.deployed()).ledger());
            console.log('W12Lister.swap', await (await W12Lister.deployed()).swap());
        });
    }
};
