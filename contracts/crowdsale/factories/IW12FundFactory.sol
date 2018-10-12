pragma solidity ^0.4.24;

import "../IW12Fund.sol";


interface IW12FundFactory {
    function createFund(address swap, address serviceWallet, uint trancheFeePercent) external returns (IW12Fund);
}
