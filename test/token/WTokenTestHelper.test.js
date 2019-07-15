require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const WTokenTestHelperTest = artifacts.require('WTokenTestHelper');
const WToken = artifacts.require('WToken');
const oneToken = new BigNumber(10).pow(18);

contract('WTokenTestHelper', async (accounts) => {
    const ctx = {};
    const allowedChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

    before(async () => {
        ctx.contract = await WTokenTestHelperTest.new();
    });

    describe('token creation', () => {
        const tokenNames = ['abcde', 'fghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ 01', '23456789'];
        const symbols = ['abc', 'defgh', 'ijklm', 'nopqr', 'stuvw', 'xyzAB', 'CDEFG', 'HIJKL', 'MNOPQ', 'RSTUV', 'WXYZ0', '12345', '6789'];
        const decimalsList = [2, 18];
        const amountList = [100, utils.round(BigNumber.UINT_MAX.div(BigNumber.TEN.pow(18)))];

        for (const name of tokenNames) {
            it(`should create token with name "${name}"`, async () => {
                await ctx.contract.createToken(name, '123', 18, 100)
                    .should.to.be.fulfilled;
            });
        }

        for (const symbol of symbols) {
            it(`should create token with symbol "${symbol}"`, async () => {
                await ctx.contract.createToken('12345', symbol, 18, 100)
                    .should.to.be.fulfilled;
            });
        }

        for (const decimals of decimalsList) {
            it(`should create token with decimal "${decimals}"`, async () => {
                await ctx.contract.createToken('12345', '123', decimals, 100)
                    .should.to.be.fulfilled;
            });
        }

        for (const amount of amountList) {
            it(`should create token and mint "${amount}"`, async () => {
                await ctx.contract.createToken('12345', '123', 18, amount)
                    .should.to.be.fulfilled;
            });
        }

        it('should`t create token if `name` contains not allowed symbols', async () => {
            await ctx.contract.createToken('_%&$+-^*><"\'}{][', '123', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `name` length less then 5', async () => {
            await ctx.contract.createToken('1234', '123', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `name` length greater then 50', async () => {
            await ctx.contract.createToken('012345678901234567890123456789012345678901234567890', '123', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `name` contains space followed by space', async () => {
            await ctx.contract.createToken('01  2345', '123', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `symbol` contains not allowed symbols', async () => {
            await ctx.contract.createToken('12345', '_%&$', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `symbol` length greater then 5', async () => {
            await ctx.contract.createToken('12345', '012345', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `symbol` length less then 3', async () => {
            await ctx.contract.createToken('12345', '01', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `symbol` contains space followed by space', async () => {
            await ctx.contract.createToken('012345', '0  34', 2, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `decimals` less then 2', async () => {
            await ctx.contract.createToken('12345', '123', 1, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if `decimals` greater then 18', async () => {
            await ctx.contract.createToken('12345', '123', 19, 100)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if mint amount less then 100', async () => {
            await ctx.contract.createToken('12345', '123', 2, 99)
                .should.be.rejectedWith(utils.EVMRevert);
        });

        it('should`t create token if mint amount greater then max', async () => {
            await ctx.contract.createToken('12345', '123', 18, utils.round(BigNumber.UINT_MAX.div(BigNumber.TEN.pow(18))).plus(1))
                .should.be.rejectedWith(utils.EVMRevert);
        });

        describe('should create token and', () => {
            before(async () => {
                ctx.Tx = await ctx.contract.createToken('12345', '123', 2, 100);
            });

            it('fill token description', async () => {
                const tx = await ctx.Tx;

                const logs = tx.logs;

                logs.length.should.be.eq(1);
                logs[0].args.tokenAddress.should.not.to.be.empty;

                const address = logs[0].args.tokenAddress;
                const token = WToken.at(address);

                const name = await token.name();
                const symbol = await token.symbol();
                const decimals = await token.decimals();

                name.should.to.be.eq('12345');
                symbol.should.to.be.eq('123');
                decimals.should.bignumber.eq(2);
            });

            it('mint token on sender balance', async () => {
                const tx = await ctx.Tx;

                const logs = tx.logs;

                logs.length.should.be.eq(1);
                logs[0].args.tokenAddress.should.not.to.be.empty;

                const address = logs[0].args.tokenAddress;
                const token = WToken.at(address);

                const balance = await token.balanceOf(accounts[0]);

                balance.should.bignumber.eq(10000);
            });
        })
    })

    it('should mint tokens', async () => {
        const tx = await ctx.contract.createToken('12345', '123', 18, 100);
        const logs = tx.logs;

        const address = logs[0].args.tokenAddress;
        const token = WToken.at(address);

        await ctx.contract.mint(address, accounts[0], 100, 0)
            .should.to.be.fulfilled;

        const balance = await token.balanceOf(accounts[0]);

        balance.should.bignumber.eq(new BigNumber(100).mul(BigNumber.TEN.pow(18)).mul(2));
    });

    it('should revert mint if token does not exist', async () => {
        const helper = await WTokenTestHelperTest.new();
        const address = utils.generateRandomAddress();

        await helper.mint(address, accounts[0], 100, 0)
            .should.be.rejectedWith(utils.EVMRevert);
    });
})
