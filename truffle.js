require('babel-register');
require('babel-polyfill');

module.exports = {
    networks: {
        development: {
            host: '127.0.0.1',
            port: 7545,
            network_id: '*', // Match any network id
            gas: 12000000,
            gasPrice: 1
        }
    },
    mocha: {
        // grep: ''
    }
};
