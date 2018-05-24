pragma solidity 0.4.23;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "../openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WToken.sol";
import "./W12ExchangeSwap.sol";


contract W12Lister is Ownable, ReentrancyGuard {
    using SafeMath for uint;

    mapping (address => ListedToken) public approvedTokens;
    mapping (address => WToken) public listingTokenToWToken;
    mapping (address => ERC20) public listingWTokenToToken;
    W12ExchangeSwap public swap;
    address public serviceWallet;

    event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner, string name, string symbol);
    event TokenPlaced(address indexed originalTokenAddress, uint tokenAmount, address placedTokenAddress);

    struct ListedToken {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => bool) approvedOwners;
        uint8 feePercent;
        address crowdsaleAddress;
        uint tokensForSaleAmount;
        uint wTokensIssuedAmount;
    }

    constructor(address _serviceWallet) public {
        require(_serviceWallet != address(0x0));

        swap = new W12ExchangeSwap();
        serviceWallet = _serviceWallet;
    }

    function whitelistToken(address tokenOwner, address tokenAddress, string name, string symbol, uint8 decimals, uint8 feePercent)
        external onlyOwner {

        require(tokenOwner != address(0x0));
        require(tokenAddress != address(0x0));
        require(feePercent < 100);
        require(!approvedTokens[tokenAddress].approvedOwners[tokenOwner]);

        approvedTokens[tokenAddress].approvedOwners[tokenOwner] = true;
        approvedTokens[tokenAddress].name = name;
        approvedTokens[tokenAddress].symbol = symbol;
        approvedTokens[tokenAddress].decimals = decimals;
        approvedTokens[tokenAddress].feePercent = feePercent;

        emit OwnerWhitelisted(tokenAddress, tokenOwner, name, symbol);
    }

    function placeToken(address tokenAddress, uint amount) external nonReentrant {
        require(amount > 0);
        require(tokenAddress != address(0x0));

        ListedToken storage listedToken = approvedTokens[tokenAddress];

        require(listedToken.approvedOwners[msg.sender]);

        ERC20 token = ERC20(tokenAddress);
        uint balanceBefore = token.balanceOf(swap);
        uint fee = approvedTokens[tokenAddress].feePercent > 0
            ? amount.mul(approvedTokens[tokenAddress].feePercent).div(100)
            : 0;

        uint amountWithoutFee = amount.sub(fee);

        approvedTokens[tokenAddress].tokensForSaleAmount = approvedTokens[tokenAddress].tokensForSaleAmount.add(amountWithoutFee);
        token.transferFrom(msg.sender, swap, amountWithoutFee);
        token.transferFrom(msg.sender, serviceWallet, fee);

        uint balanceAfter = token.balanceOf(swap);

        require(balanceAfter == balanceBefore.add(amountWithoutFee));
        
        if(listingTokenToWToken[tokenAddress] == address(0x0)) {
            listingTokenToWToken[tokenAddress] = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);
            listingWTokenToToken[listingTokenToWToken[tokenAddress]] = ERC20(tokenAddress);
        }

        emit TokenPlaced(tokenAddress, amountWithoutFee, listingTokenToWToken[tokenAddress]);
    }

    function initCrowdsale(address crowdsaleAddress, address tokenAddress, uint amountForSale) external onlyOwner nonReentrant {
        require(crowdsaleAddress != address(0x0));
        require(approvedTokens[tokenAddress].tokensForSaleAmount <= approvedTokens[tokenAddress].wTokensIssuedAmount.add(amountForSale));

        approvedTokens[tokenAddress].wTokensIssuedAmount = approvedTokens[tokenAddress].wTokensIssuedAmount.add(amountForSale);
        approvedTokens[tokenAddress].crowdsaleAddress = crowdsaleAddress;
        getWTokenByToken(tokenAddress).mint(crowdsaleAddress, amountForSale);
    }

    function getWTokenByToken(address token) public view returns (WToken wTokenAddress) {
        require(token != address(0x0));

        wTokenAddress = listingTokenToWToken[token];

        require(wTokenAddress != address(0x0));

        return wTokenAddress;
    }

    function getTokenByWToken(address wToken) public view returns (ERC20 tokenAddress) {
        require(wToken != address(0x0));

        tokenAddress = listingWTokenToToken[wToken];

        require(tokenAddress != address(0x0));

        return tokenAddress;
    }
}
