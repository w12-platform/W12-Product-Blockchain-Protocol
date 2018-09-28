const ERC20Token = artifacts.require('WTokenStub');
const WTokenTestHelper = artifacts.require('WTokenTestHelper');
const utils = require('../shared/utils');

module.exports = function (deployer, network, accounts) {
   if (network === 'test') {
       deployer.then(async () => {
           deployer.deploy(ERC20Token, 'TestToken1', 'TT1', 18);
           // https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
           await utils.wait(10000);
           deployer.deploy(WTokenTestHelper, {overwrite: false});
           // https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
           await utils.wait(10000);
       });
   }
};
