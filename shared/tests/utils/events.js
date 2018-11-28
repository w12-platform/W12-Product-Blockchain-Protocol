const {isBigNumber} = require('./common');

function inLogs(logs, eventName, eventArgs = {}) {
    const event = logs.find(function (e) {
        if (e.event === eventName) {
            for (const [k, v] of Object.entries(eventArgs)) {
                contains(e.args, k, v);
            }
            return true;
        }
    });
    should.exist(event);
    return event;
}

async function inTransaction(tx, eventName, eventArgs = {}) {
    const {logs} = await tx;
    return inLogs(logs, eventName, eventArgs);
}

function contains(args, key, value) {
    if (isBigNumber(args[key])) {
        args[key].should.be.bignumber.equal(value);
    } else if (Array.isArray(args[key]) || typeof args[key] === 'object') {
        for (const [k, v] of Object.entries(args[key])) {
            contains(args[key], k, v);
        }
    } else {
        args[key].should.be.equal(value);
    }
}

module.exports = {
    inLogs,
    inTransaction,
    contains
};
