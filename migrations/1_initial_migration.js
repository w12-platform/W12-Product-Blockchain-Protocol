const Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer, network, accounts) {
  if (network === 'test') {
      deployer.deploy(Migrations);
  }
};
