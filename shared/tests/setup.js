global.crypto = require('crypto');

global.BigNumber = web3.BigNumber;

global.BigNumber.Zero = new BigNumber(0);
global.BigNumber.UINT_MAX = (new BigNumber(2)).pow(256).minus(1);
global.BigNumber.TEN = new BigNumber(10);

const chai = require('chai');

global.should = chai
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(global.BigNumber))
    .use(require('chai-arrays'))
    .should();

global.bytes = require('utf8-bytes');
global.nanoid = require('nanoid');

chai.use(function (_chai, _) {
  _chai.Assertion.addMethod('withMessage', function (msg) {
    _.flag(this, 'message', msg);
  });
});
