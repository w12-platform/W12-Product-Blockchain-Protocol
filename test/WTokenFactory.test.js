require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const WTokenFactoryStub = artifacts.require('WTokenFactoryStub');
const WToken = artifacts.require('WToken');

contract('WTokenFactoryStub', async (accounts) => {
    it('should create token', async () => {
        const factory = await WTokenFactoryStub.new();
        const receipt = await factory.createToken('Name', 'NA', 18);
        const logs = receipt.logs;

        logs.length.should.be.eq(1);
        logs[0].args.tokenAddress.should.not.to.be.empty;

        const address = logs[0].args.tokenAddress;
        const token = WToken.at(address);

        const name = await token.name().should.to.be.fulfilled;

        name.should.to.be.eq('Name');
    });
})
