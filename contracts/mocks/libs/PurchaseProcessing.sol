pragma solidity ^0.4.24;

import "../../libs/PurchaseProcessing.sol";

contract PurchaseProcessingMock {

    function checkInvoiceInput(
        bytes32 method,
        uint paymentAmount,
        uint methodUSDRate,
        uint tokenUSDRate,
        uint currentBalanceInTokens,
        uint tokenDecimals,
        uint methodDecimals
    ) public view returns(bool) {
        return PurchaseProcessing.checkInvoiceInput(
            method,
            paymentAmount,
            methodUSDRate,
            tokenUSDRate,
            currentBalanceInTokens,
            tokenDecimals,
            methodDecimals
        );
    }

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
        public view returns(uint[5])
    {
        return PurchaseProcessing.invoice(
            method,
            paymentAmount,
            discount,
            volumeBoundaries,
            volumeBonuses,
            methodUSDRate,
            tokenUSDRate,
            tokenDecimals,
            methodDecimals,
            currentBalanceInTokens
        );
    }

    function fee(uint tokenAmount, uint cost, uint tokenFee, uint purchaseFee) public view returns(uint[2]) {
        return PurchaseProcessing.fee(
            tokenAmount,
            cost,
            tokenFee,
            purchaseFee
        );
    }

    function transferFee(
        uint [2] _fee,
        bytes32 method,
        address methodToken,
        address token,
        address originToken,
        address exchanger,
        address serviceWallet
    ) public payable {
        PurchaseProcessing.transferFee(
            _fee,
            method,
            methodToken,
            token,
            originToken,
            exchanger,
            serviceWallet
        );
    }

    function transferPurchase(uint[5] _invoice, uint[2] _fee, uint32 vesting, bytes32 method, address methodToken, address token) public payable {
        PurchaseProcessing.transferPurchase(
            _invoice,
            _fee,
            vesting,
            method,
            methodToken,
            token
        );
    }

    function getBonus(uint value, uint[] volumeBoundaries, uint[] volumeBonuses) public view returns(uint bonus) {
        return PurchaseProcessing.getBonus(
            value,
            volumeBoundaries,
            volumeBonuses
        );
    }

    function () public payable {}
}
