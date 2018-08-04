async function setPurchaseRecords(fund, records, tokenPrice, tokenDecimals, from) {
    tokenPrice = new BigNumber(tokenPrice);
    tokenDecimals = new BigNumber(tokenDecimals);

    const multiplier = (new BigNumber(10)).pow(tokenDecimals);
    const result = [];
    let totalCost = BigNumber.Zero;
    let totalBought = BigNumber.Zero;

    for (let record of records) {
        const buyer = record.buyer;
        const tokens = new BigNumber(record.tokens);
        const boughtTokens = tokens.mul(multiplier);
        const cost = tokenPrice.mul(tokens);

        await fund.recordPurchase(buyer, boughtTokens, {
            from: from,
            value: cost
        });

        totalCost = totalCost.plus(cost);
        totalBought = totalBought.plus(boughtTokens);

        result.push({
            buyer,
            tokens,
            boughtTokens,
            cost
        });
    }

    return {
        args: result,
        totalCost,
        totalBought,
        fund,
        records,
        tokenPrice,
        tokenDecimals,
        from
    };
}

module.exports = {
    setPurchaseRecords
}
