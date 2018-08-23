pragma solidity ^0.4.24;

interface IW12AtomicSwap {
    function approve(address token, address spender, uint amount) external returns (bool);

    function exchange(address fromToken, uint amount) external;
}
