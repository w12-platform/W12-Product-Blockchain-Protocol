const ERC20Token = artifacts.require('WTokenStub');

module.exports = function (deployer, network, accounts) {
   if (network === 'test') {
       deployer.deploy(ERC20Token, 'TestToken1', 'TT1', 18);
   }
};
