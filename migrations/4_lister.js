const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12Lister = artifacts.require('W12ListerStub');

module.exports = async function (deployer, network, accounts) {
    if (network === 'test') {
        const owner = accounts[0];
        const serviceWallet = accounts[0];

        await deployer.deploy(W12Lister, W12CrowdsaleFactory.address, { gas: 7700000 });

        console.log('owner', owner);
        console.log('W12CrowdsaleFactory', W12CrowdsaleFactory.address);
        console.log('W12Lister.serviceWallet', serviceWallet);
        console.log('W12Lister.ledger', await (await W12Lister.deployed()).ledger());
        console.log('W12Lister.swap', await (await W12Lister.deployed()).swap());
    }
};
