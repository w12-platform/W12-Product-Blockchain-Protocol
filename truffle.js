require('babel-register');
require('babel-polyfill');

const HDWalletProvider = require("truffle-hdwallet-provider");
const deployConfig = require('./config.js');
const PrivateKeyProvider = require("truffle-privatekey-provider");

module.exports = {
    networks: {
        development: {
            host: '127.0.0.1',
            port: 7545,
            network_id: '*', // Match any network id
            gasPrice: 0,
            gas: 8000000
        },
        test: {
            provider() {
                return new HDWalletProvider(deployConfig.mnemonic, `https://rinkeby.infura.io/v3/${deployConfig.infuraKey}`)
            },
            network_id: 4,
            gasPrice: 10000000000,
        },
        mainnet: {
            provider () {
                return new PrivateKeyProvider(deployConfig.mainnetAccountPK, `https://mainnet.infura.io/v3/${deployConfig.infuraKey}`)
            },
            network_id: 1,
            gasPrice: 6000000000,
        }
    },
    mocha: {
        grep: '',
        bail: true
    },
    solc: {
        optimizer: {
            enabled: true
        }
    }
};
