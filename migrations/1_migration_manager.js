const Migrations = artifacts.require("./Migrations.sol");
const Versions = artifacts.require("./versioning/VersionsLedger.sol");
const version = require('../package').version;
const semint = require('@redtea/semint');
const semver = require('semver');
const utils = require('../shared/utils');

module.exports = function(deployer, network, accounts) {
    if (network === 'test') {
        deployer.then(async () => {
            if (!semint.isValid(version, 4)) throw new Error('version in package.json is not valid');

            // firstly deploy versions ledger
            await deployer.deploy(Versions, {overwrite: false});
            // https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
            await utils.wait(10000);
            // get all existing versions
            const versions = (await (await Versions.deployed()).getVersions())
                .map(v => semint.decode(v.toNumber(), 4));

            console.log('deployed versions: ', versions.join(', '));

            const exists = versions.length ? semver.satisfies(version, versions.join('||')) : false;

            if (exists) throw new Error(`version ${version} already deployed`);

            await deployer.deploy(Migrations, semint.encode(version, 4));
            // https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
            await utils.wait(10000);
        });
    }
};
