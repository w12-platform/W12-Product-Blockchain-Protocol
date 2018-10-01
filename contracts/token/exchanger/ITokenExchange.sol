pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract ITokenExchange {
    function approve(ERC20 token, address spender, uint amount) external returns (bool);

    function exchange(ERC20 fromToken, uint amount) external;
}
