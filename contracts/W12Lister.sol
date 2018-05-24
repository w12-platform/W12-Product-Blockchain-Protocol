pragma solidity ^0.4.23;

import "./WToken.sol";
import "./W12AtomicSwap.sol";
import "./W12TokenLedger.sol";
import "./IW12Crowdsale.sol";


contract W12Lister is Ownable, ReentrancyGuard {
    using SafeMath for uint;

    mapping (address => ListedToken) public approvedTokens;
    W12AtomicSwap public swap;
    W12TokenLedger public ledger;
    address public serviceWallet;
    IW12CrowdsaleFactory public factory;

    event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner, string name, string symbol);
    event TokenPlaced(address indexed originalTokenAddress, uint tokenAmount, address placedTokenAddress);

    struct ListedToken {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => bool) approvedOwners;
        uint8 feePercent;
        IW12Crowdsale crowdsaleAddress;
        uint tokensForSaleAmount;
        uint wTokensIssuedAmount;
    }

    constructor(address _serviceWallet, IW12CrowdsaleFactory _factory) public {
        require(_serviceWallet != address(0x0));
        require(_factory != address(0x0));

        ledger = new W12TokenLedger();
        swap = new W12AtomicSwap(ledger);
        serviceWallet = _serviceWallet;
        factory = _factory;
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
        
        if(ledger.getWTokenByToken(tokenAddress) == address(0x0)) {
            WToken wToken = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);
            ledger.addTokenToListing(ERC20(tokenAddress), wToken);
        }

        emit TokenPlaced(tokenAddress, amountWithoutFee, ledger.getWTokenByToken(tokenAddress));
    }

    function initCrowdsale(uint32 _startDate, address tokenAddress, uint amountForSale, uint price, uint8 serviceFee) external onlyOwner nonReentrant {
        require(approvedTokens[tokenAddress].tokensForSaleAmount <= approvedTokens[tokenAddress].wTokensIssuedAmount.add(amountForSale));

        IW12Crowdsale crowdsaleAddress = factory.createCrowdsale(address(ledger.getWTokenByToken(tokenAddress)), _startDate, price, serviceWallet, serviceFee, owner);

        approvedTokens[tokenAddress].wTokensIssuedAmount = approvedTokens[tokenAddress].wTokensIssuedAmount.add(amountForSale);
        approvedTokens[tokenAddress].crowdsaleAddress = crowdsaleAddress;
        ledger.getWTokenByToken(tokenAddress).mint(crowdsaleAddress, amountForSale, 0);
    }

    function getTokenCrowdsale(address tokenAddress) view external returns (address) {
        require(approvedTokens[tokenAddress].crowdsaleAddress != address(0x0));

        return approvedTokens[tokenAddress].crowdsaleAddress;
    }
}
