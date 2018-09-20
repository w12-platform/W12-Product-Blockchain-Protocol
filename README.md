| Tests status   |            |
|:---------------|:-------------:|
|Build & tests   |[![CircleCI](https://circleci.com/gh/w12-platform/W12-Product-Blockchain-Protocol.svg?style=svg)](https://circleci.com/gh/w12-platform/W12-Product-Blockchain-Protocol) |



# Migrate to test network

1. Rename `example.config.js` to `config.js`
2. Set own infura token
3. Set own mnemonic
4. run `$ npm run t:migration:test`

# Project structure

* *abi/{contracts version}/* - lite versions of artifacts that includes only abi and contract name. Directory contains artifacts only for versions that has changes from previously version.

# Commands

 * `npm run abi` - generate lite versions of artifacts.
