pragma solidity ^0.4.24;

import "../../libs/PurchaseProcessing.sol";

contract PurchaseProcessingMock {

    bool public _checkInvoiceInputCallResult;

    function checkInvoiceInput(
        bytes32 method,
        uint paymentAmount,
        uint methodUSDRate,
        uint tokenUSDRate,
        uint currentBalanceInTokens,
        uint tokenDecimals,
        uint methodDecimals
    ) public payable {
        _checkInvoiceInputCallResult = PurchaseProcessing.checkInvoiceInput(
            method,
            paymentAmount,
            methodUSDRate,
            tokenUSDRate,
            currentBalanceInTokens,
            tokenDecimals,
            methodDecimals
        );
    }

    uint[5] public __invoiceCallResult;
    function _invoiceCallResult() public view returns(uint[5]) { return __invoiceCallResult; }

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
        public payable
    {
        __invoiceCallResult = PurchaseProcessing.invoice(
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

    uint[2] public __feeCallResult;
    function _feeCallResult() public view returns(uint[2]) {return __feeCallResult;}

    function fee(uint tokenAmount, uint cost, uint tokenFee, uint purchaseFee) public {
        __feeCallResult = PurchaseProcessing.fee(
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

    function transferPurchase(uint[5] _invoice, uint32 vesting, bytes32 method, address methodToken, address token) public payable {
        PurchaseProcessing.transferPurchase(
            _invoice,
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
}
