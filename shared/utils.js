function wait(ms) {
    return new Promise((rs, rj) => setTimeout(rs, ms));
}

// https://github.com/trufflesuite/truffle-migrate/issues/29#issuecomment-389649903
async function deploy(deployer, contract, ...args) {
    await deployer.deploy(contract, ...args);
    await contract.deployed();
    await wait(20000);
}

module.exports = {
    wait,
    deploy
}
