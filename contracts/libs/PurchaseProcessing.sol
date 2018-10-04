pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./Percent.sol";
import "../token/IWToken.sol";

library PurchaseProcessing {
    using SafeMath for uint;
    using Percent for uint;

    function METHOD_ETH() internal pure returns (bytes32) {return bytes32('ETH');}

    function checkInvoiceInput(
        bytes32 method,
        uint paymentAmount,
        uint methodUSDRate,
        uint tokenUSDRate,
        uint currentBalanceInTokens,
        uint tokenDecimals,
        uint methodDecimals
    ) internal returns(bool result) {
        result = paymentAmount > 0
            && methodUSDRate > 0
            && tokenUSDRate > 0
            && currentBalanceInTokens >= 10 ** tokenDecimals;

        if (method == METHOD_ETH()) {
            result = result && paymentAmount == msg.value && methodDecimals == 18;
        }
    }

    /**
     * @notice Calculate invoice
     * @dev 1 USD = 10^8. In this case precision will be up to 10^8 decimals after point
     * @param method Payment method
     * @param paymentAmount Payment amount
     * @param discount Discount
     * @param volumeBoundaries Volume boundaries to calculate bonus
     * @param volumeBonuses List of bonuses bound to boundaries
     * @param methodUSDRate Payment method rate in USD
     * @param tokenUSDRate Token rate in USD
     * @param tokenDecimals Token decimal
     * @param methodDecimals Method decimal. N for token, 18 for ETH
     * @param currentBalanceInTokens Current balance in tokens
     * @return uint[5] result Invoice calculation result:
     *
     * [tokenAmount, cost, costUSD, change, actualTokenPriceUSD]
     *
     * [0] tokenAmount - amount of token to buy
     * [1] cost - cost in method currency
     * [2] costUSD cost in USD
     * [3] change - change in method currency
     * [4] actualTokenPriceUSD - actual token price in USD(with discount)
     */
    function invoice(
        bytes32 method,
        uint paymentAmount,
        uint discount,
        uint[] volumeBoundaries,
        uint[] volumeBonuses,
        uint methodUSDRate,
        uint tokenUSDRate,
        uint tokenDecimals,
        uint methodDecimals,
        uint currentBalanceInTokens
    )
        internal returns(uint[5] result)
    {
        require(checkInvoiceInput(
            method,
            paymentAmount,
            methodUSDRate,
            tokenUSDRate,
            currentBalanceInTokens,
            tokenDecimals,
            methodDecimals
        ));

        // costUSD
        // 0 0123456789 * 0 00012345 / 10 ** 10 = 0 00000152 . 4074060205
        result[2] = paymentAmount.mul(methodUSDRate).div(10 ** methodDecimals);

        // min costUSD = tokenUSDRate
        // tokenUSDRate = 1 00005555
        require(result[2] >= tokenUSDRate);

        // 13 33
        uint bonus = getBonus(result[2], volumeBoundaries, volumeBonuses);

        // priceUSD
        // 1 00005555 * (100 00 - 22 22) / 100 00 = 0 77784320 . 679
        result[4] = discount > 0
            ? tokenUSDRate.percent(Percent.MAX() - discount)
            : tokenUSDRate;

        // tokens
        // 0 00000152 * (10000 + 1333) * 10 ** 10 / (0 77784320 * 10000) = 0 0000022146 . 057200217216
        result[0] = result[2]
            .mul(Percent.MAX().add(bonus))
            .mul(10 ** tokenDecimals)
            .div(result[4].mul(Percent.MAX()));

        // if current balance is not enough
        if (currentBalanceInTokens < result[0]) {
            // 0 0000012146 * 0 77784320 / 10 ** 10 = 0 00000094 . 476835072
            result[2] = currentBalanceInTokens.mul(result[4])
                .div(10 ** tokenDecimals);
            result[0] = currentBalanceInTokens;
        }

        // cost
        // 0 00000152 * 10 ** 10 / 0 00012345 = 0 0123126771 . 97245848
        // if (currentBalanceInTokens < result[0]): 0 00000094 * 10 ** 10 / 0 00012345 = 0 0076144187 . 93033616
        result[1] = result[2].mul(10 ** methodDecimals).div(methodUSDRate);

        // change
        // 0 0123456789 - 0 0123126771 = 0 0000330018
        // if (currentBalanceInTokens < result[0]): 0 0123456789 - 0 0076144187 = 0 0047312602
        result[3] = paymentAmount.sub(result[1]);
    }

    function fee(uint tokenAmount, uint cost, uint tokenFee, uint purchaseFee) internal returns(uint[2] result) {
        if (tokenFee > 0) result[0] = tokenAmount.percent(tokenFee);
        if (purchaseFee > 0) result[1] = cost.percent(purchaseFee);
    }

    function transferFee(
        uint [2] _fee,
        bytes32 method,
        address methodToken,
        address token,
        address originToken,
        address exchanger,
        address serviceWallet
    ) internal {
        require(originToken != address(0));
        require(token != address(0));
        require(exchanger != address(0));
        require(serviceWallet != address(0));

        if (_fee[1] > 0 && method != METHOD_ETH()) {
            require(methodToken != address(0));
        }

        if (_fee[0] > 0) {
            require(ERC20(originToken).transferFrom(exchanger, serviceWallet, _fee[0]));
            require(ERC20(token).transfer(exchanger, _fee[0]));
        }

        if (_fee[1] > 0) {
            if (method == METHOD_ETH()) {
                serviceWallet.transfer(_fee[1]);
            } else {
                require(ERC20(methodToken).transfer(serviceWallet, _fee[1]));
            }
        }
    }

    function transferPurchase(uint[5] _invoice, uint32 vesting, bytes32 method, address methodToken, address token) internal {
        require(token != address(0));

        if (_invoice[3] > 0 && method != METHOD_ETH()) {
            require(methodToken != address(0));
        }

        require(IWToken(token).vestingTransfer(msg.sender, _invoice[0], vesting));

        if (_invoice[3] > 0) {
            if (method == METHOD_ETH()) {
                msg.sender.transfer(_invoice[3]);
            } else {
                require(ERC20(token).transfer(msg.sender, _invoice[3]));
            }
        }
    }

    function getBonus(uint value, uint[] volumeBoundaries, uint[] volumeBonuses) internal view returns(uint bonus) {
        for (uint i = 0; i < volumeBoundaries.length; i++) {
            if (value >= volumeBoundaries[i]) {
                bonus = volumeBonuses[i];
            } else {
                break;
            }
        }
    }
}
