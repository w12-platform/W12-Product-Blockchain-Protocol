require('../../shared/tests/setup.js');

const utils = require('../../shared/tests/utils.js');

const WToken = artifacts.require('WToken');

contract('WToken', function ([_, owner, recipient, anotherAccount, burner]) {

  beforeEach(async function () {
    this.token = await WToken.new("WToken", "WToken", 18, {gas: 7000000});
    await this.token.mint(owner, 100, 0);
  });

  describe('total supply', function () {
    it('returns the total amount of tokens', async function () {
      const totalSupply = await this.token.totalSupply();

      assert.equal(totalSupply, 100);
    });
  });

  describe('balanceOf', function () {
    describe('when the requested account has no tokens', function () {
      it('returns zero', async function () {
        const balance = await this.token.balanceOf(anotherAccount);

        assert.equal(balance, 0);
      });
    });

    describe('when the requested account has some tokens', function () {
      it('returns the total amount of tokens', async function () {
        const balance = await this.token.balanceOf(owner);

        assert.equal(balance, 100);
      });
    });
  });

  describe('transfer', function () {
    describe('when the recipient is not the zero address', function () {
      const to = recipient;

      describe('when the sender does not have enough balance', function () {
        const amount = 101;

        it('reverts', async function () {
          await (this.token.transfer(to, amount, { from: owner })).should.be.rejectedWith(utils.EVMRevert);
        });
      });

      describe('when the sender has enough balance', function () {
        const amount = 100;

        it('transfers the requested amount', async function () {
          await this.token.transfer(to, amount, { from: owner });

          const senderBalance = await this.token.balanceOf(owner);
          assert.equal(senderBalance, 0);

          const recipientBalance = await this.token.balanceOf(to);
          assert.equal(recipientBalance, amount);
        });

        it('emits a transfer event', async function () {
          const { logs } = await this.token.transfer(to, amount, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Transfer');
          assert.equal(logs[0].args.from, owner);
          assert.equal(logs[0].args.to, to);
          assert(logs[0].args.value.eq(amount));
        });
      });
    });

    describe('when the recipient is the zero address', function () {
      const to = utils.ZERO_ADDRESS;

      it('reverts', async function () {
        await (this.token.transfer(to, 100, { from: owner })).should.be.rejectedWith(utils.EVMRevert);
      });
    });
  });

  describe('approve', function () {
    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        const amount = 100;

        it('emits an approval event', async function () {
          const { logs } = await this.token.approve(spender, amount, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.approve(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, { from: owner });
          });

          it('approves the requested amount and replaces the previous one', async function () {
            await this.token.approve(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount);
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = 101;

        it('emits an approval event', async function () {
          const { logs } = await this.token.approve(spender, amount, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.approve(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, { from: owner });
          });

          it('approves the requested amount and replaces the previous one', async function () {
            await this.token.approve(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount);
          });
        });
      });
    });

    describe('when the spender is the zero address', function () {
      const amount = 100;
      const spender = utils.ZERO_ADDRESS;

      it('approves the requested amount', async function () {
        await this.token.approve(spender, amount, { from: owner });

        const allowance = await this.token.allowance(owner, spender);
        assert.equal(allowance, amount);
      });

      it('emits an approval event', async function () {
        const { logs } = await this.token.approve(spender, amount, { from: owner });

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Approval');
        assert.equal(logs[0].args.owner, owner);
        assert.equal(logs[0].args.spender, spender);
        assert(logs[0].args.value.eq(amount));
      });
    });
  });

  describe('transfer from', function () {
    const spender = recipient;

    describe('when the recipient is not the zero address', function () {
      const to = anotherAccount;

      describe('when the spender has enough approved balance', function () {
        beforeEach(async function () {
          await this.token.approve(spender, 100, { from: owner });
        });

        describe('when the owner has enough balance', function () {
          const amount = 100;

          it('transfers the requested amount', async function () {
            await this.token.transferFrom(owner, to, amount, { from: spender });

            const senderBalance = await this.token.balanceOf(owner);
            assert.equal(senderBalance, 0);

            const recipientBalance = await this.token.balanceOf(to);
            assert.equal(recipientBalance, amount);
          });

          it('decreases the spender allowance', async function () {
            await this.token.transferFrom(owner, to, amount, { from: spender });

            const allowance = await this.token.allowance(owner, spender);
            assert(allowance.eq(0));
          });

          it('emits a transfer event', async function () {
            const { logs } = await this.token.transferFrom(owner, to, amount, { from: spender });

            assert.equal(logs.length, 1);
            assert.equal(logs[0].event, 'Transfer');
            assert.equal(logs[0].args.from, owner);
            assert.equal(logs[0].args.to, to);
            assert(logs[0].args.value.eq(amount));
          });
        });

        describe('when the owner does not have enough balance', function () {
          const amount = 101;

          it('reverts', async function () {
            await (this.token.transferFrom(owner, to, amount, { from: spender })).should.be.rejectedWith(utils.EVMRevert);
          });
        });
      });

      describe('when the spender does not have enough approved balance', function () {
        beforeEach(async function () {
          await this.token.approve(spender, 99, { from: owner });
        });

        describe('when the owner has enough balance', function () {
          const amount = 100;

          it('reverts', async function () {
            await (this.token.transferFrom(owner, to, amount, { from: spender })).should.be.rejectedWith(utils.EVMRevert);
          });
        });

        describe('when the owner does not have enough balance', function () {
          const amount = 101;

          it('reverts', async function () {
            await (this.token.transferFrom(owner, to, amount, { from: spender })).should.be.rejectedWith(utils.EVMRevert);
          });
        });
      });
    });

    describe('when the recipient is the zero address', function () {
      const amount = 100;
      const to = utils.ZERO_ADDRESS;

      beforeEach(async function () {
        await this.token.approve(spender, amount, { from: owner });
      });

      it('reverts', async function () {
        await (this.token.transferFrom(owner, to, amount, { from: spender })).should.be.rejectedWith(utils.EVMRevert);
      });
    });
  });

  describe('decrease approval', function () {
    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        const amount = 100;

        it('emits an approval event', async function () {
          const { logs } = await this.token.decreaseApproval(spender, amount, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(0));
        });

        describe('when there was no approved amount before', function () {
          it('keeps the allowance to zero', async function () {
            await this.token.decreaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, 0);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, amount + 1, { from: owner });
          });

          it('decreases the spender allowance subtracting the requested amount', async function () {
            await this.token.decreaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, 1);
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = 101;

        it('emits an approval event', async function () {
          const { logs } = await this.token.decreaseApproval(spender, amount, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(0));
        });

        describe('when there was no approved amount before', function () {
          it('keeps the allowance to zero', async function () {
            await this.token.decreaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, 0);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, amount + 1, { from: owner });
          });

          it('decreases the spender allowance subtracting the requested amount', async function () {
            await this.token.decreaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, 1);
          });
        });
      });
    });

    describe('when the spender is the zero address', function () {
      const amount = 100;
      const spender = utils.ZERO_ADDRESS;

      it('decreases the requested amount', async function () {
        await this.token.decreaseApproval(spender, amount, { from: owner });

        const allowance = await this.token.allowance(owner, spender);
        assert.equal(allowance, 0);
      });

      it('emits an approval event', async function () {
        const { logs } = await this.token.decreaseApproval(spender, amount, { from: owner });

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Approval');
        assert.equal(logs[0].args.owner, owner);
        assert.equal(logs[0].args.spender, spender);
        assert(logs[0].args.value.eq(0));
      });
    });
  });

  describe('increase approval', function () {
    const amount = 100;

    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        it('emits an approval event', async function () {
          const { logs } = await this.token.increaseApproval(spender, amount, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, { from: owner });
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount + 1);
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = 101;

        it('emits an approval event', async function () {
          const { logs } = await this.token.increaseApproval(spender, amount, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, { from: owner });
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, { from: owner });

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, amount + 1);
          });
        });
      });
    });

    describe('when the spender is the zero address', function () {
      const spender = utils.ZERO_ADDRESS;

      it('approves the requested amount', async function () {
        await this.token.increaseApproval(spender, amount, { from: owner });

        const allowance = await this.token.allowance(owner, spender);
        assert.equal(allowance, amount);
      });

      it('emits an approval event', async function () {
        const { logs } = await this.token.increaseApproval(spender, amount, { from: owner });

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Approval');
        assert.equal(logs[0].args.owner, owner);
        assert.equal(logs[0].args.spender, spender);
        assert(logs[0].args.value.eq(amount));
      });
    });
  });

  describe('vesting', async function () {
    describe('when called by the owner', async () => {
      it('should allow to add trusted accounts', async function () {
        await this.token.vestingTransfer(recipient, 5, 0, { from: owner }).should.be.rejectedWith(utils.EVMRevert);
        await this.token.addTrustedAccount(owner).should.be.fulfilled;
        await this.token.vestingTransfer(recipient, 5, 0, { from: owner }).should.be.fulfilled;
      });
    });

    describe('when owner added to trusted accounts', async function () {
      beforeEach(async function () {
        await this.token.addTrustedAccount(owner);
      });

      it('should be applied to a transfer', async function () {
        const expectedAmount = 13;
        const expectedVesting = web3.eth.getBlock('latest').timestamp + utils.time.duration.minutes(10);

        const { logs } = await this.token.vestingTransfer(recipient, expectedAmount, expectedVesting, { from: owner }).should.be.fulfilled;

        logs.length.should.be.equal(2);
        logs[1].event.should.be.equal('VestingTransfer');
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

        await this.token.transfer(anotherAccount, 1, { from: recipient }).should.be.rejectedWith(utils.EVMRevert);

        await utils.time.increaseTimeTo(expectedVesting + 10);

        await this.token.transfer(anotherAccount, 1, { from: recipient }).should.be.fulfilled;
      });
    });
  });

  describe('burn', function () {
      const initialBalance = 100;

      describe('when the given amount is not greater than balance of the sender', function () {
          const amount = 100;

          beforeEach(async function () {
              ({logs: this.logs} = await this.token.burn(amount, {from: owner}));
          });

          it('burns the requested amount', async function () {
              const balance = await this.token.balanceOf(owner);
              balance.should.be.bignumber.equal(initialBalance - amount);
          });

          it('emits a burn event', async function () {
              const event = await utils.expectEvent.inLogs(this.logs, 'Burn');
              event.args.burner.should.eq(owner);
              event.args.value.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
              const event = await utils.expectEvent.inLogs(this.logs, 'Transfer');
              event.args.from.should.eq(owner);
              event.args.to.should.eq(utils.ZERO_ADDRESS);
              event.args.value.should.be.bignumber.equal(amount);
          });
      });

      describe('when the given amount is greater than the balance of the sender', function () {
          const amount = initialBalance + 1;

          it('reverts', async function () {
              await this.token.burn(amount, {from: owner})
                  .should.be.rejectedWith(utils.EVMRevert);
          });
      });

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
              await this.token.burn(initialAmount, {from: owner})
                  .should.be.rejectedWith(utils.EVMRevert);
          });
      });
  });

  describe('burnFrom', function () {
      const initialBalance = 100;

      describe('on success', function () {
          const amount = 50;

          beforeEach(async function () {
              await this.token.approve(burner, 100, {from: owner});
              const {logs} = await this.token.burnFrom(owner, amount, {from: burner});
              this.logs = logs;
          });

          it('burns the requested amount', async function () {
              const balance = await this.token.balanceOf(owner);
              balance.should.be.bignumber.equal(initialBalance - amount);
          });

          it('decrements allowance', async function () {
              const allowance = await this.token.allowance(owner, burner);
              allowance.should.be.bignumber.equal(50);
          });

          it('emits a burn event', async function () {
              const event = await utils.expectEvent.inLogs(this.logs, 'Burn');
              event.args.burner.should.eq(owner);
              event.args.value.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
              const event = await utils.expectEvent.inLogs(this.logs, 'Transfer');
              event.args.from.should.eq(owner);
              event.args.to.should.eq(utils.ZERO_ADDRESS);
              event.args.value.should.be.bignumber.equal(amount);
          });
      });

      describe('when the given amount is greater than the balance of the sender', function () {
          const amount = initialBalance + 1;
          it('reverts', async function () {
              await this.token.approve(burner, amount, {from: owner});
              await this.token.burnFrom(owner, amount, {from: burner})
                  .should.be.rejectedWith(utils.EVMRevert);
          });
      });

      describe('when the given amount is greater than the allowance', function () {
          const amount = 50;

          it('reverts', async function () {
              await this.token.approve(burner, amount - 1, {from: owner});
              await this.token.burnFrom(owner, amount, {from: burner})
                  .should.be.rejectedWith(utils.EVMRevert);
          });
      });
  });
});
