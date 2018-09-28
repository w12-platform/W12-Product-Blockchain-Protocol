function wait(ms) {
    return new Promise((rs, rj) => setTimeout(rs, ms));
}

module.exports = {
    wait
}
