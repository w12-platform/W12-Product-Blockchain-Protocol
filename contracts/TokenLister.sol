pragma solidity 0.4.23;

import "./Ownable.sol";
import "./ERC20.sol";
import "./WToken.sol";


contract TokenLister is Ownable {

    mapping (address => ListedToken) approvedTokens;
    mapping (address => WToken) listing;

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

        ListedToken storage listedToken = approvedTokens[tokenAddress];

        require(listedToken.approvedOwners[msg.sender]);

        ERC20 token = ERC20(tokenAddress);
        uint balanceBefore = token.balanceOf(address(this));
        token.transferFrom(msg.sender, address(this), amount);
        uint balanceAfter = token.balanceOf(address(this));

        require(balanceBefore < balanceAfter);
        require(balanceAfter == balanceBefore + amount);
        
        if(listing[tokenAddress] == address(0x0)) {
            listing[tokenAddress] = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);
        }

        emit TokenPlaced(tokenAddress, amount, listing[tokenAddress]);
    }
}
