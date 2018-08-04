const utils = require('../../shared/tests/utils.js');

const WToken = artifacts.require('WToken');

async function createToken(owner) {
    const id = nanoid();
    const name = `Test Token ${id}`;
    const symbol = `TT${id.slice(0, 2)}`;
    const decimals = new BigNumber(18);

    const token = await WToken.new(name, symbol, decimals, { from: owner });

    return {
        id,
        args: {
            name,
            symbol,
            decimals,
        },
        token,
        owner,
        txParams: {
            from: owner
        }
    };
}

module.exports = {
    createToken
}
