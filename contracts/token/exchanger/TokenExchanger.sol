pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "../../versioning/Versionable.sol";
import "../IWToken.sol";
import "./ITokenExchanger.sol";


contract TokenExchanger is ITokenExchanger, Versionable, Secondary, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for ERC20Detailed;
    using SafeERC20 for IERC20;

    mapping(address => IWToken) public listingTokenToWToken;
    mapping(address => ERC20Detailed) public listingWTokenToToken;
    mapping(address => mapping(address => bool)) pairs;

    event Exchange(address indexed from, address indexed to, uint amount, address indexed sender);

    constructor(uint version) Versionable(version) public {}

    function addTokenToListing(ERC20Detailed token, IWToken wToken) external onlyPrimary {
        require(token != address(0));
        require(wToken != address(0));
        require(address(listingTokenToWToken[token]) == address(0));
        require(address(token) != address(wToken));
        require(!hasPair(ERC20Detailed(token), ERC20Detailed(wToken)));

        listingTokenToWToken[token] = wToken;
        listingWTokenToToken[wToken] = token;
        pairs[token][wToken] = true;
    }

    function hasPair(ERC20Detailed token1, ERC20Detailed token2) public view returns (bool) {
        return pairs[token1][token2] || pairs[token2][token1];
    }

    function getWTokenByToken(address token) public view returns (IWToken) {
        require(token != address(0));

        return listingTokenToWToken[token];
    }

    function getTokenByWToken(address wToken) public view returns (ERC20Detailed) {
        require(wToken != address(0));

        return listingWTokenToToken[wToken];
    }

    function approve(IERC20 token, address spender, uint amount) external onlyPrimary returns (bool) {
        return token.approve(spender, amount);
    }

    function exchange(IERC20 fromToken, uint amount) external nonReentrant {
        require(amount > 0);
        require(fromToken != address(0));
        // Checking if fromToken is WToken and have actual pair
        IERC20 toToken = getTokenByWToken(fromToken);
        require(toToken != address(0));
        // we won't check `amount` for zero because ERC20 implies zero amount transfers as a valid case

        fromToken.safeTransferFrom(msg.sender, address(this), amount);
        toToken.safeTransfer(msg.sender, amount);

        emit Exchange(address(fromToken), address(toToken), amount, msg.sender);
    }
}
