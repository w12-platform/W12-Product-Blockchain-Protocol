pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../WToken.sol";

contract ITokenLedger {
    function addTokenToListing(ERC20 token, WToken wToken) external;

    function hasPair(ERC20 token1, ERC20 token2) public view returns (bool);

    function getWTokenByToken(address token) public view returns (WToken wTokenAddress);

    function getTokenByWToken(address wToken) public view returns (ERC20 tokenAddress);
}
