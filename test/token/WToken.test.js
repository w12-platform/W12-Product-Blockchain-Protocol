require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const WToken = artifacts.require('WToken');

contract('WToken', function ([_, owner, recipient, anotherAccount, burner]) {

  beforeEach(async function () {
    this.token = await WToken.new("WToken", "WToken", 18, {gas: 7000000});
    await this.token.mint(owner, 100, 0);
  });

  describe('vesting', async function () {
    describe('when called by the owner', async () => {
      it('should allow to add trusted accounts', async function () {
        await utils.shouldFail.reverting(this.token.vestingTransfer(recipient, 5, 0, { from: owner }));
        await this.token.addAdmin(owner).should.be.fulfilled;
        await this.token.vestingTransfer(recipient, 5, 0, { from: owner }).should.be.fulfilled;
      });
    });

    describe('when owner added to trusted accounts', async function () {
      beforeEach(async function () {
        await this.token.addAdmin(owner);
      });

      it('should be applied to a transfer', async function () {
        const expectedAmount = 13;
        const expectedVesting = web3.eth.getBlock('latest').timestamp + utils.time.duration.minutes(10);

        const { logs } = await this.token.vestingTransfer(recipient, expectedAmount, expectedVesting, { from: owner }).should.be.fulfilled;

        logs.length.should.be.equal(2);
        logs[1].event.should.be.equal('VestingTransferred');
        logs[1].args.from.should.be.equal(owner);
        logs[1].args.to.should.be.equal(recipient);
        logs[1].args.value.should.bignumber.equal(expectedAmount);
        logs[1].args.agingTime.should.bignumber.equal(expectedVesting);

        const actualVestedBalance = await this.token.accountBalance(recipient).should.be.fulfilled;

        actualVestedBalance.should.bignumber.equal(0);

        const actualVestingBalance = await this.token.balanceOf(recipient).should.be.fulfilled;

        actualVestingBalance.should.bignumber.equal(expectedAmount);
      });

      it('should vest until specified date', async function () {
        const expectedAmount = 13;
        const expectedVesting = web3.eth.getBlock('latest').timestamp + utils.time.duration.minutes(10);

        await this.token.vestingTransfer(recipient, expectedAmount, expectedVesting, { from: owner }).should.be.fulfilled;

        await utils.shouldFail.reverting(this.token.transfer(anotherAccount, 1, { from: recipient }));

        await utils.time.increaseTimeTo(expectedVesting + 10);

        await this.token.transfer(anotherAccount, 1, { from: recipient }).should.be.fulfilled;
      });
    });
  });

  describe('burn', function () {

      describe('vesting', function () {
          const initialAmount = 200;
          const vestingAmount = 100;
          const vesting = web3.eth.getBlock('latest').timestamp + utils.time.duration.days(1);

          beforeEach(async function () {
              await this.token.mint(owner, 100, vesting);
          });

          it('should burn', async function () {
              await this.token.burn(initialAmount - vestingAmount, {from: owner})
                  .should.be.fulfilled;

              const balance = await this.token.accountBalance(owner);
              balance.should.be.bignumber.equal(0);
          });

          it('should revert', async function () {
              await utils.shouldFail.reverting(this.token.burn(initialAmount, {from: owner}));
          });
      });
  });
});
