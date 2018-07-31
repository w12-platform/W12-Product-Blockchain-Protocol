require('../shared/tests/setup.js');

const utils = require('../shared/tests/utils.js');

const WTokenTestHelperTest = artifacts.require('WTokenTestHelper');
const WToken = artifacts.require('WToken');

contract('WTokenTestHelper', async (accounts) => {
    it('should create token', async () => {
        const helper = await WTokenTestHelperTest.new();
        const receipt = await helper.createToken('Name', 'NA', 18);
        const logs = receipt.logs;

        logs.length.should.be.eq(1);
        logs[0].args.tokenAddress.should.not.to.be.empty;

        const address = logs[0].args.tokenAddress;
        const token = WToken.at(address);

        const name = await token.name().should.to.be.fulfilled;
        const tokens = await helper.tokensList();

        name.should.to.be.eq('Name');
        tokens.length.should.to.be.eq(1);
        tokens[0].should.to.be.eq(address);
    });

    it('should mint tokens', async () => {
        const helper = await WTokenTestHelperTest.new();
        await helper.createToken('Name', 'NA', 18);
        const tokens = await helper.tokensList();
        const address = tokens[0];
        const token = WToken.at(address);

        await helper.mint(address, accounts[0], 100, 0).should.to.be.fulfilled;

        const balance = await token.balanceOf(accounts[0]).should.to.be.fulfilled;

        balance.should.bignumber.eq(100);
    });

    it('should revert mint if token is not exists', async () => {
        const helper = await WTokenTestHelperTest.new();
        const address = utils.generateRandomAddress();

        await helper.mint(address, accounts[0], 100, 0).should.be.rejectedWith(utils.EVMRevert);
    });
})
