global.crypto = require('crypto');

global.BigNumber = web3.BigNumber;

global.BigNumber.Zero = new BigNumber(0);

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(global.BigNumber))
    .use(require('chai-arrays'))
    .should();

global.bytes = require('utf8-bytes');
global.nanoid = require('nanoid');
