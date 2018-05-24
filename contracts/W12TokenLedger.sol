pragma solidity ^0.4.23;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "./WToken.sol";


contract W12TokenLedger is Ownable, ReentrancyGuard {
    mapping (address => WToken) public listingTokenToWToken;
    mapping (address => ERC20) public listingWTokenToToken;
    mapping (address => mapping (address => bool)) pairs;

    function addTokenToListing(ERC20 token, WToken wToken) external onlyOwner nonReentrant {
        require(token != address(0x0));
        require(wToken != address(0x0));
        require(token != wToken);
        require(!hasPair(token, wToken));

        listingTokenToWToken[token] = wToken;
        listingWTokenToToken[wToken] = token;
        pairs[token][wToken] = true;
    }

    function hasPair(ERC20 token1, ERC20 token2) public view returns (bool) {
        return pairs[token1][token2] || pairs[token2][token1];
    }

    function getWTokenByToken(address token) public view returns (WToken wTokenAddress) {
        require(token != address(0x0));

        wTokenAddress = listingTokenToWToken[token];
    }

    function getTokenByWToken(address wToken) public view returns (ERC20 tokenAddress) {
        require(wToken != address(0x0));

        tokenAddress = listingWTokenToToken[wToken];
    }
}
