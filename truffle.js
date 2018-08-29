require('babel-register');
require('babel-polyfill');

const HDWalletProvider = require("truffle-hdwallet-provider");
const deployConfig = require('./config.js');

module.exports = {
    networks: {
        development: {
            host: '127.0.0.1',
            port: 7545,
            network_id: '*', // Match any network id
            gasPrice: 0,
            gas: 8000000,
            gasLimit: 8000000
        },
        test: {
            provider() {
                return new HDWalletProvider(deployConfig.mnemonic, `https://rinkeby.infura.io/${deployConfig.infuraKey}`)
            },
            network_id: 4
        },
    },
    mocha: {
        // grep: ''
    },
    optimizer: {
        enabled: true
    }
};
