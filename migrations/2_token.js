const ERC20Token = artifacts.require('WTokenStub');
const WTokenTestHelper = artifacts.require('WTokenTestHelper');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
   if (network === 'test') {
       deployer.then(async () => {
           await utils.deploy(network, deployer, ERC20Token, 'TestToken1', 'TT1', 18);

           utils.migrateLog.addAddress(ERC20Token.contractName, ERC20Token.address);

           await utils.deploy(network, deployer, WTokenTestHelper, {overwrite: false});

           utils.migrateLog.addAddress(WTokenTestHelper.contractName, WTokenTestHelper.address);
       });
   }
};
