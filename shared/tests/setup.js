import * as time from '../../openzeppelin-solidity/test/helpers/increaseTime';
import assertRevert from '../../openzeppelin-solidity/test/helpers/assertRevert';

global.crypto = require('crypto');

global.BigNumber = web3.BigNumber;

global.openzeppelinHelpers = {
    time,
    assertRevert
};

global.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

global.BigNumber.Zero = new BigNumber(0);

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(global.BigNumber))
    .use(require('chai-arrays'))
    .should();

