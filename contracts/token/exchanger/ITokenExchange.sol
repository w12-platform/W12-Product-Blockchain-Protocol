pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract ITokenExchange {
    function approve(IERC20 token, address spender, uint amount) external returns (bool);

    function exchange(IERC20 fromToken, uint amount) external;
}
