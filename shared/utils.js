const fs = require('fs');
const pkd = require('../package');

function wait(ms) {
    return new Promise((rs, rj) => setTimeout(rs, ms));
}

// https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
const MAX_ATTEMPTS = 3;

async function deploy(net, deployer, contract, ...args) {
    let count = MAX_ATTEMPTS;
    let error;

    while(count) {
        try {
            return await deployer.deploy(contract, ...args);
        } catch (e) {
            error = e;
            if (net !== 'test') {
                break;
            }
            console.log(`Deploy attempt number ${count} was failed for contract ${contract.contractName}`);
        }
        count--;
    }

    if(error) {
        throw error;
    }
}

const migrateLog = {
    create(net) {
        fs.writeFileSync(
            `.MIGRATE_v${pkd.version}`,
            `Network ${net}\n`,
            { encoding: 'utf-8', flag: 'w' });
    },
    addAddress (name, address) {
        fs.writeFileSync(
            `.MIGRATE_v${pkd.version}`,
            `${name} - ${address}\n`,
            {encoding: 'utf-8', flag: 'a'});
    },
    clear() {
        fs.writeFileSync(
            `.MIGRATE_v${pkd.version}`,
            '',
            {encoding: 'utf-8', flag: 'w'});
    }
}

module.exports = {
    wait,
    deploy,
    migrateLog
}
