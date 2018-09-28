pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "../../versioning/Versionable.sol";
import "../WToken.sol";
import "./ITokenExchanger.sol";


contract TokenExchanger is ITokenExchanger, Versionable, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for ERC20;

    mapping(address => WToken) public listingTokenToWToken;
    mapping(address => ERC20) public listingWTokenToToken;
    mapping(address => mapping(address => bool)) pairs;

    event Exchange(address indexed from, address indexed to, uint amount, address indexed sender);

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

    function approve(ERC20 token, address spender, uint amount) external onlyOwner returns (bool) {
        return token.approve(spender, amount);
    }

    function exchange(ERC20 fromToken, uint amount) external nonReentrant {
        require(amount > 0);
        require(fromToken != address(0));
        // Checking if fromToken is WToken and have actual pair
        ERC20 toToken = getTokenByWToken(fromToken);
        require(toToken != address(0));
        // we won't check `amount` for zero because ERC20 implies zero amount transfers as a valid case

        fromToken.safeTransferFrom(msg.sender, address(this), amount);
        toToken.safeTransfer(msg.sender, amount);

        emit Exchange(address(fromToken), address(toToken), amount, msg.sender);
    }
}
