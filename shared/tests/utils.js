import * as time from '../../openzeppelin-solidity/test/helpers/increaseTime';
import EVMRevert from '../../openzeppelin-solidity/test/helpers/EVMRevert';

function generateRandomAddress () {
    return `0x${crypto.randomBytes(20).toString('hex')}`;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

module.exports = {
    time,
    EVMRevert,
    ZERO_ADDRESS,
    generateRandomAddress
}
