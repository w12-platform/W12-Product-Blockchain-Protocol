pragma solidity ^0.4.23;

import "./WToken.sol";
import "./W12TokenLedger.sol";
import "./interfaces/IW12CrowdsaleFactory.sol";
import "../openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";


contract W12Lister is Ownable, ReentrancyGuard {
    using SafeMath for uint;

    mapping (address => uint16) public approvedTokensIndex;
    ListedToken[] public approvedTokens;
    uint16 public approvedTokensLength;
    address public swap;
    W12TokenLedger public ledger;
    address public serviceWallet;
    IW12CrowdsaleFactory public factory;

    event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner, string name, string symbol);
    event TokenPlaced(address indexed originalTokenAddress, uint tokenAmount, address placedTokenAddress);
    event CrowdsaleInitialized(uint startDate, address indexed tokenAddress, uint amountForSale);

    struct ListedToken {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => bool) approvedOwners;
        uint8 feePercent;
        uint8 ethFeePercent;
        IW12Crowdsale crowdsaleAddress;
        uint tokensForSaleAmount;
        uint wTokensIssuedAmount;
        address tokenAddress;
    }

    constructor(address _serviceWallet, IW12CrowdsaleFactory _factory, W12TokenLedger _ledger, address _swap) public {
        require(_serviceWallet != address(0));
        require(_factory != address(0));
        require(_ledger != address(0));
        require(_swap != address(0));

        ledger = _ledger;
        swap = _swap;
        serviceWallet = _serviceWallet;
        factory = _factory;
        approvedTokens.length++; // zero-index element should never be used
    }

    function whitelistToken(address tokenOwner, address tokenAddress, string name, string symbol, uint8 decimals, uint8 feePercent, uint8 ethFeePercent)
        external onlyOwner {

        require(tokenOwner != address(0));
        require(tokenAddress != address(0));
        require(feePercent < 100);
        require(ethFeePercent < 100);
        require(!approvedTokens[approvedTokensIndex[tokenAddress]].approvedOwners[tokenOwner]);

        uint16 index = uint16(approvedTokens.length);
        approvedTokensIndex[tokenAddress] = index;

        approvedTokensLength = uint16(approvedTokens.length++);

        approvedTokens[index].approvedOwners[tokenOwner] = true;
        approvedTokens[index].name = name;
        approvedTokens[index].symbol = symbol;
        approvedTokens[index].decimals = decimals;
        approvedTokens[index].feePercent = feePercent;
        approvedTokens[index].ethFeePercent = ethFeePercent;
        approvedTokens[index].tokenAddress = tokenAddress;

        emit OwnerWhitelisted(tokenAddress, tokenOwner, name, symbol);
    }

    function placeToken(address tokenAddress, uint amount) external nonReentrant {
        require(amount > 0);
        require(tokenAddress != address(0));
        require(approvedTokensIndex[tokenAddress] > 0);

        ListedToken storage listedToken = approvedTokens[approvedTokensIndex[tokenAddress]];

        require(listedToken.approvedOwners[msg.sender]);

        ERC20 token = ERC20(tokenAddress);
        uint balanceBefore = token.balanceOf(swap);
        uint fee = listedToken.feePercent > 0
            ? amount.mul(listedToken.feePercent).div(100)
            : 0;

        uint amountWithoutFee = amount.sub(fee);

        approvedTokens[approvedTokensIndex[tokenAddress]].tokensForSaleAmount = listedToken.tokensForSaleAmount.add(amountWithoutFee);
        token.transferFrom(msg.sender, swap, amountWithoutFee);
        token.transferFrom(msg.sender, serviceWallet, fee);

        uint balanceAfter = token.balanceOf(swap);

        require(balanceAfter == balanceBefore.add(amountWithoutFee));

        if(ledger.getWTokenByToken(tokenAddress) == address(0)) {
            WToken wToken = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);
            ledger.addTokenToListing(ERC20(tokenAddress), wToken);
        }

        emit TokenPlaced(tokenAddress, amountWithoutFee, ledger.getWTokenByToken(tokenAddress));
    }

    function initCrowdsale(uint32 startDate, address tokenAddress, uint amountForSale, uint price) external nonReentrant {
        require(approvedTokens[approvedTokensIndex[tokenAddress]].approvedOwners[msg.sender] == true);
        require(approvedTokens[approvedTokensIndex[tokenAddress]].tokensForSaleAmount >= approvedTokens[approvedTokensIndex[tokenAddress]].wTokensIssuedAmount.add(amountForSale));
        require(approvedTokens[approvedTokensIndex[tokenAddress]].crowdsaleAddress == address(0));

        WToken wtoken = ledger.getWTokenByToken(tokenAddress);

        IW12Crowdsale crowdsale = factory.createCrowdsale(address(wtoken),
        startDate,
        price,
        serviceWallet,
        approvedTokens[approvedTokensIndex[tokenAddress]].ethFeePercent,
        swap,
        msg.sender);

        approvedTokens[approvedTokensIndex[tokenAddress]].crowdsaleAddress = crowdsale;
        wtoken.addTrustedAccount(crowdsale);

        addTokensToCrowdsale(tokenAddress, amountForSale);

        emit CrowdsaleInitialized(startDate, tokenAddress, amountForSale);
    }

    function addTokensToCrowdsale(address tokenAddress, uint amountForSale) public {
        require(approvedTokens[approvedTokensIndex[tokenAddress]].approvedOwners[msg.sender] == true);
        require(approvedTokens[approvedTokensIndex[tokenAddress]].tokensForSaleAmount >= approvedTokens[approvedTokensIndex[tokenAddress]].wTokensIssuedAmount.add(amountForSale));

        WToken token = ledger.getWTokenByToken(tokenAddress);

        require(token != address(0));

        IW12Crowdsale crowdsale = approvedTokens[approvedTokensIndex[tokenAddress]].crowdsaleAddress;

        require(crowdsale != address(0));

        approvedTokens[approvedTokensIndex[tokenAddress]].wTokensIssuedAmount = approvedTokens[approvedTokensIndex[tokenAddress]]
            .wTokensIssuedAmount.add(amountForSale);

        token.mint(crowdsale, amountForSale, 0);
    }

    function getTokenCrowdsale(address tokenAddress) view external returns (address) {
        require(approvedTokens[approvedTokensIndex[tokenAddress]].crowdsaleAddress != address(0));

        return approvedTokens[approvedTokensIndex[tokenAddress]].crowdsaleAddress;
    }

    function getSwap() view external returns (address) {
        return swap;
    }
}
