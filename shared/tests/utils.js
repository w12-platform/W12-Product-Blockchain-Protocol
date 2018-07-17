function generateRandomAddress () {
    return `0x${crypto.randomBytes(20).toString('hex')}`;
};

module.exports = {
    generateRandomAddress
}
