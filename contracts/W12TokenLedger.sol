pragma solidity ^0.4.23;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./WToken.sol";
import "./versioning/Versionable.sol";


contract W12TokenLedger is Versionable, Ownable {
    mapping (address => WToken) public listingTokenToWToken;
    mapping (address => ERC20) public listingWTokenToToken;
    mapping (address => mapping (address => bool)) pairs;

    constructor(uint version) Versionable(version) public {}

    function addTokenToListing(ERC20 token, WToken wToken) external onlyOwner {
        require(token != address(0));
        require(wToken != address(0));
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
        require(token != address(0));

        wTokenAddress = listingTokenToWToken[token];
    }

    function getTokenByWToken(address wToken) public view returns (ERC20 tokenAddress) {
        require(wToken != address(0));

        tokenAddress = listingWTokenToToken[wToken];
    }
}
