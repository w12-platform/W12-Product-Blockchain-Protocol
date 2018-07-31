const ERC20Token = artifacts.require('WTokenStub');
const WTokenTestHelper = artifacts.require('WTokenTestHelper');

module.exports = function (deployer, network, accounts) {
   if (network === 'test') {
       deployer.deploy(ERC20Token, 'TestToken1', 'TT1', 18);
       deployer.deploy(WTokenTestHelper, {overwrite: false});
   }
};
