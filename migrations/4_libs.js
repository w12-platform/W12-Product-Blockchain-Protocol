// libs
const Crowdsale = artifacts.require('Crowdsale');
const FundAccount = artifacts.require('FundAccount');
const PaymentMethods = artifacts.require('PaymentMethods');
const Percent = artifacts.require('Percent');
const PurchaseProcessing = artifacts.require('PurchaseProcessing');
const Utils = artifacts.require('Utils');
const Fund = artifacts.require('Fund');
// contracts
const W12Crowdsale = artifacts.require('W12Crowdsale');
const W12CrowdsaleFactory = artifacts.require('W12CrowdsaleFactory');
const W12FundFactory = artifacts.require('W12FundFactory');
const W12Fund = artifacts.require('W12Fund');
const W12Lister = artifacts.require('W12Lister');
// stubs/mocks
const UtilsMock = artifacts.require('UtilsMock');
const W12CrowdsaleStub = artifacts.require('W12CrowdsaleStub');
const W12FundStub = artifacts.require('W12FundStub');
const W12ListerStub = artifacts.require('W12ListerStub');
const PurchaseProcessingMock = artifacts.require('PurchaseProcessingMock');
const PercentMock = artifacts.require('PercentMock');

const utils = require('../shared/utils');


module.exports = function (deployer, network, accounts) {
    deployer.then(async () => {
        await utils.deploy(network, deployer, Utils);

        Percent.link(Utils);

        await utils.deploy(network, deployer, Percent);
        await utils.deploy(network, deployer, FundAccount);
        await utils.deploy(network, deployer, PaymentMethods);

        Crowdsale.link(Percent);
        PurchaseProcessing.link(Utils);
        PurchaseProcessing.link(Percent);
        Fund.link(Utils);
        Fund.link(Percent);
        Fund.link(FundAccount);

        console.log('fund-------------------------------');
        await utils.deploy(network, deployer, Fund);
        await utils.deploy(network, deployer, Crowdsale);
        await utils.deploy(network, deployer, PurchaseProcessing);

        if (network === 'test' || network === 'mainnet') {
            utils.migrateLog.addAddress(Percent.contractName, Percent.address);
            utils.migrateLog.addAddress(Utils.contractName, Utils.address);
            utils.migrateLog.addAddress(FundAccount.contractName, FundAccount.address);
            utils.migrateLog.addAddress(PaymentMethods.contractName, PaymentMethods.address);
            utils.migrateLog.addAddress(Crowdsale.contractName, Crowdsale.address);
            utils.migrateLog.addAddress(PurchaseProcessing.contractName, PurchaseProcessing.address);
        }

        // crowdsale, crowdsale stub, crowdsale factory
        W12CrowdsaleStub.link(Percent);
        W12CrowdsaleStub.link(PaymentMethods);
        W12CrowdsaleStub.link(PurchaseProcessing);
        W12CrowdsaleStub.link(Crowdsale);
        W12Crowdsale.link(Percent);
        W12Crowdsale.link(PaymentMethods);
        W12Crowdsale.link(PurchaseProcessing);
        W12Crowdsale.link(Crowdsale);
        W12CrowdsaleFactory.link(Percent);
        W12CrowdsaleFactory.link(PaymentMethods);
        W12CrowdsaleFactory.link(PurchaseProcessing);
        W12CrowdsaleFactory.link(Crowdsale);

        // fund, fund factory
        W12Fund.link(Utils);
        W12Fund.link(Percent);
        W12Fund.link(FundAccount);
        W12Fund.link(Fund);
        W12FundStub.link(Percent);
        W12FundStub.link(FundAccount);
        W12FundStub.link(Utils);
        W12FundStub.link(Fund);
        W12FundFactory.link(Utils);
        W12FundFactory.link(Percent);
        W12FundFactory.link(FundAccount);
        W12FundFactory.link(Fund);

        // lister, lister stub
        W12Lister.link(Percent);
        W12ListerStub.link(Percent);

        if (network === 'development') {
            PurchaseProcessingMock.link(PurchaseProcessing);
            UtilsMock.link(Utils);
            PercentMock.link(Percent);
        }
    });
};
