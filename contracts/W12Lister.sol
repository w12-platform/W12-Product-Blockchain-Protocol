pragma solidity ^0.4.24;

import "./WToken.sol";
import "./W12TokenLedger.sol";
import "./interfaces/IW12CrowdsaleFactory.sol";
import "./interfaces/IW12AtomicSwap.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "./libs/Percent.sol";
import "./versioning/Versionable.sol";


contract W12Lister is Versionable, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using Percent for uint;

    // get token index in approvedTokens list by token address and token owner address
    mapping (address => mapping (address => uint16)) public approvedTokensIndex;
    ListedToken[] public approvedTokens;
    // return owners by token address
    mapping ( address => address[] ) approvedOwnersList;
    uint16 public approvedTokensLength;
    IW12AtomicSwap public swap;
    W12TokenLedger public ledger;
    address public serviceWallet;
    IW12CrowdsaleFactory public factory;

    event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner, string name, string symbol);
    event TokenPlaced(address indexed originalTokenAddress, address indexed tokenOwner, uint tokenAmount, address placedTokenAddress);
    event CrowdsaleInitialized(address indexed tokenAddress, address indexed tokenOwner, uint amountForSale);
    event CrowdsaleTokenMinted(address indexed tokenAddress, address indexed tokenOwner, uint amount);

    struct ListedToken {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => bool) approvedOwners;
        uint feePercent;
        uint ethFeePercent;
        uint WTokenSaleFeePercent;
        uint trancheFeePercent;
        IW12Crowdsale crowdsaleAddress;
        uint tokensForSaleAmount;
        uint wTokensIssuedAmount;
        address tokenAddress;
    }

    constructor(
        uint version,
        address _serviceWallet,
        IW12CrowdsaleFactory _factory,
        W12TokenLedger _ledger,
        IW12AtomicSwap _swap
    ) Versionable(version) public {
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

    function whitelistToken(
        address tokenOwner,
        address tokenAddress,
        string name,
        string symbol,
        uint8 decimals,
        uint feePercent,
        uint ethFeePercent,
        uint WTokenSaleFeePercent,
        uint trancheFeePercent
    )
        external onlyOwner {

        require(tokenOwner != address(0));
        require(tokenAddress != address(0));
        require(feePercent.isPercent() && feePercent.fromPercent() < 100);
        require(ethFeePercent.isPercent() && ethFeePercent.fromPercent() < 100);
        require(WTokenSaleFeePercent.isPercent() && WTokenSaleFeePercent.fromPercent() < 100);
        require(trancheFeePercent.isPercent() && trancheFeePercent.fromPercent() < 100);
        require(getApprovedToken(tokenAddress, tokenOwner).tokenAddress != tokenAddress);
        require(!getApprovedToken(tokenAddress, tokenOwner).approvedOwners[tokenOwner]);

        uint16 index = uint16(approvedTokens.length);

        approvedTokensIndex[tokenAddress][tokenOwner] = index;

        approvedTokensLength = uint16(approvedTokens.length++);

        approvedOwnersList[tokenAddress].push(tokenOwner);

        approvedTokens[index].approvedOwners[tokenOwner] = true;
        approvedTokens[index].name = name;
        approvedTokens[index].symbol = symbol;
        approvedTokens[index].decimals = decimals;
        approvedTokens[index].feePercent = feePercent;
        approvedTokens[index].ethFeePercent = ethFeePercent;
        approvedTokens[index].WTokenSaleFeePercent = WTokenSaleFeePercent;
        approvedTokens[index].trancheFeePercent = trancheFeePercent;
        approvedTokens[index].tokenAddress = tokenAddress;

        emit OwnerWhitelisted(tokenAddress, tokenOwner, name, symbol);
    }

    function placeToken(address tokenAddress, uint amount) external nonReentrant {
        require(amount > 0);
        require(tokenAddress != address(0));
        require(getApprovedToken(tokenAddress, msg.sender).tokenAddress == tokenAddress);
        require(getApprovedToken(tokenAddress, msg.sender).approvedOwners[msg.sender]);

        ListedToken storage listedToken = getApprovedToken(tokenAddress, msg.sender);

        DetailedERC20 token = DetailedERC20(tokenAddress);

        require(token.decimals() == listedToken.decimals);

        uint balanceBefore = token.balanceOf(swap);
        uint fee = listedToken.feePercent > 0
            ? amount.percent(listedToken.feePercent)
            : 0;
        uint amountWithoutFee = amount.sub(fee);

        // check for overflow. we are not sure that the placed token has implemented save math
        token.balanceOf(swap).add(amountWithoutFee);
        token.balanceOf(serviceWallet).add(fee);

        token.transferFrom(msg.sender, swap, amountWithoutFee);
        token.transferFrom(msg.sender, serviceWallet, fee);

        listedToken.tokensForSaleAmount = listedToken.tokensForSaleAmount.add(amountWithoutFee);

        if(ledger.getWTokenByToken(tokenAddress) == address(0)) {
            WToken wToken = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);

            ledger.addTokenToListing(ERC20(tokenAddress), wToken);
        }

        emit TokenPlaced(tokenAddress, msg.sender, amountWithoutFee, ledger.getWTokenByToken(tokenAddress));
    }

    function initCrowdsale(address tokenAddress, uint amountForSale, uint price) external nonReentrant {
        require(getApprovedToken(tokenAddress, msg.sender).approvedOwners[msg.sender] == true);
        require(getApprovedToken(tokenAddress, msg.sender).tokensForSaleAmount >= getApprovedToken(tokenAddress, msg.sender).wTokensIssuedAmount.add(amountForSale));
        require(getApprovedToken(tokenAddress, msg.sender).crowdsaleAddress == address(0));

        WToken wtoken = ledger.getWTokenByToken(tokenAddress);

        IW12Crowdsale crowdsale = factory.createCrowdsale(
            address(tokenAddress),
            address(wtoken),
            price,
            serviceWallet,
            getApprovedToken(tokenAddress, msg.sender).ethFeePercent,
            getApprovedToken(tokenAddress, msg.sender).WTokenSaleFeePercent,
            getApprovedToken(tokenAddress, msg.sender).trancheFeePercent,
            swap,
            msg.sender
        );

        getApprovedToken(tokenAddress, msg.sender).crowdsaleAddress = crowdsale;
        wtoken.addTrustedAccount(crowdsale);

        if (getApprovedToken(tokenAddress, msg.sender).WTokenSaleFeePercent > 0) {
            swap.approve(
                tokenAddress,
                address(crowdsale),
                getApprovedToken(tokenAddress, msg.sender).tokensForSaleAmount
                    .percent(getApprovedToken(tokenAddress, msg.sender).WTokenSaleFeePercent)
            );
        }

        addTokensToCrowdsale(tokenAddress, amountForSale);

        emit CrowdsaleInitialized(tokenAddress, msg.sender, amountForSale);
    }

    function addTokensToCrowdsale(address tokenAddress, uint amountForSale) public {
        require(getApprovedToken(tokenAddress, msg.sender).approvedOwners[msg.sender] == true);
        require(getApprovedToken(tokenAddress, msg.sender).tokensForSaleAmount >= getApprovedToken(tokenAddress, msg.sender).wTokensIssuedAmount.add(amountForSale));

        WToken token = ledger.getWTokenByToken(tokenAddress);

        require(token != address(0));

        IW12Crowdsale crowdsale = getApprovedToken(tokenAddress, msg.sender).crowdsaleAddress;

        require(crowdsale != address(0));

        getApprovedToken(tokenAddress, msg.sender).wTokensIssuedAmount = getApprovedToken(tokenAddress, msg.sender)
            .wTokensIssuedAmount.add(amountForSale);

        token.mint(crowdsale, amountForSale, 0);

        emit CrowdsaleTokenMinted(tokenAddress, msg.sender, amountForSale);
    }

    function getTokenCrowdsale(address tokenAddress, address ownerAddress) view external returns (address) {
        return getApprovedToken(tokenAddress, ownerAddress).crowdsaleAddress;
    }

    function getTokenOwners(address token) public view returns (address[]) {
        return approvedOwnersList[token];
    }

    function getSwap() view external returns (address) {
        return swap;
    }

    function getApprovedToken(address tokenAddress, address ownerAddress) internal view returns (ListedToken storage result) {
        return approvedTokens[approvedTokensIndex[tokenAddress][ownerAddress]];
    }
}
