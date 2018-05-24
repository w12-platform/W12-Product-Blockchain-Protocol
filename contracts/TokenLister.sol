pragma solidity 0.4.23;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./ERC20.sol";
import "./WToken.sol";


contract TokenLister is Ownable {

    mapping (address => ListedToken) approvedTokens;
    mapping (address => WToken) listingTokenToWToken;
    mapping (address => ERC20) listingWTokenToToken;

    event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner, string name, string symbol, uint8 decimals);
    event TokenPlaced(address indexed originalTokenAddress, uint tokenAmount, address placedTokenAddress);

    struct ListedToken {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => bool) approvedOwners;
    }

    function whitelistToken(address tokenOwner, address tokenAddress, string name, string symbol, uint8 decimals) external onlyOwner {
        require(tokenOwner != address(0x0));
        require(tokenAddress != address(0x0));
        // require(symbol.size > 0);
        require(!approvedTokens[tokenAddress].approvedOwners[tokenOwner]);

        approvedTokens[tokenAddress].approvedOwners[tokenOwner] = true;
        approvedTokens[tokenAddress].name = name;
        approvedTokens[tokenAddress].symbol = symbol;
        approvedTokens[tokenAddress].decimals = decimals;

        emit OwnerWhitelisted(tokenAddress, tokenOwner, name, symbol, decimals);
    }

    function placeToken(address tokenAddress, uint amount) external {
        require(amount > 0);
        require(token != address(0x0));

        ListedToken storage listedToken = approvedTokens[tokenAddress];

        assert(listedToken.approvedOwners[msg.sender]);

        ERC20 token = ERC20(tokenAddress);
        uint balanceBefore = token.balanceOf(address(this));
        token.transferFrom(msg.sender, address(this), amount);
        uint balanceAfter = token.balalistingTokenToWTokennceOf(address(this));

        assert(balanceBefore < balanceAfter);
        assert(balanceAfter == balanceBefore + amount);
        
        if(listingTokenToWToken[tokenAddress] == address(0x0)) {
            listingTokenToWToken[tokenAddress] = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);
            listingWTokenToToken[listingTokenToWToken[tokenAddress]] = tokenAddress;
        }

        emit TokenPlaced(tokenAddress, amount, listingTokenToWToken[tokenAddress]);
    }

    function getWTokenByToken(address token)
        assertOutputAddress
        external view {

        require(token != address(0x0));

        address wTokenAddress = listingTokenToWToken[token];

        return wTokenAddress;
    }

    function getTokenByWToken(address wToken)
        assertOutputAddress
        external view {

        require(wToken != address(0x0));

        address tokenAddress = listingWTokenToToken[wToken];

        return tokenAddress;
    }

    modifier assertOutputAddress() {
        address result = _;

        assert(result != address(0x0));
    }
}
