function isBigNumber(object) {
    return object.isBigNumber ||
        object instanceof BigNumber ||
        (object.constructor && object.constructor.name === 'BigNumber');
}

function toBytes32(utf8string) {
    return web3.padRight(web3.fromUtf8(utf8string), 64 + 2 /* for 0x */);
}

module.exports = {
    toBytes32,
    isBigNumber
}
