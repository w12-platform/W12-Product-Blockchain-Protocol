const ERC20Token = artifacts.require('WTokenStub');
const WTokenFactoryStub = artifacts.require('WTokenFactoryStub');

module.exports = function (deployer, network, accounts) {
   if (network === 'test') {
       deployer.deploy(ERC20Token, 'TestToken1', 'TT1', 18);
       deployer.deploy(WTokenFactoryStub, {overwrite: false});
   }
};
