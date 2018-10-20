pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/access/rbac/RBAC.sol";
import "./crowdsale/factories/IW12CrowdsaleFactory.sol";
import "./wallets/IWallets.sol";
import "./libs/Percent.sol";
import "./token/WToken.sol";
import "./token/exchanger/ITokenExchanger.sol";
import "./versioning/Versionable.sol";


contract W12Lister is Versionable, RBAC, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using Percent for uint;

    uint8 constant SERVICE_WALLET_ID = 1;
    string public ROLE_ADMIN = "admin";

    ITokenExchanger public exchanger;
    IW12CrowdsaleFactory public factory;
    IWallets public wallets;
    // get token index in approvedTokens list by token address and token owner address
    mapping (address => mapping (address => uint16)) public approvedTokensIndex;
    ListedToken[] public approvedTokens;
    // return owners by token address
    mapping ( address => address[] ) approvedOwnersList;
    uint16 public approvedTokensLength;

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
        IWallets _wallets,
        IW12CrowdsaleFactory _factory,
        ITokenExchanger _exchanger
    ) Versionable(version) public {
        require(_factory != address(0));
        require(_exchanger != address(0));

        exchanger = _exchanger;
        wallets = _wallets;
        factory = _factory;
        approvedTokens.length++; // zero-index element should never be used

        addRole(msg.sender, ROLE_ADMIN);
    }

    function addAdmin(address _operator) public onlyOwner {
        addRole(_operator, ROLE_ADMIN);
    }

    function removeAdmin(address _operator) public onlyOwner {
        removeRole(_operator, ROLE_ADMIN);
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
        external onlyRole(ROLE_ADMIN)
    {

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

    /**
     * @notice Place token for sale
     * @param tokenAddress Token that will be placed
     * @param amount Token amount to place
     */
    function placeToken(address tokenAddress, uint amount) external nonReentrant {
        require(serviceWallet() != address(0));
        require(amount > 0);
        require(tokenAddress != address(0));
        require(getApprovedToken(tokenAddress, msg.sender).tokenAddress == tokenAddress);
        require(getApprovedToken(tokenAddress, msg.sender).approvedOwners[msg.sender]);

        DetailedERC20 token = DetailedERC20(tokenAddress);

        require(token.allowance(msg.sender, address(this)) >= amount);

        ListedToken storage listedToken = getApprovedToken(tokenAddress, msg.sender);

        require(token.decimals() == listedToken.decimals);

        uint fee = listedToken.feePercent > 0
            ? amount.percent(listedToken.feePercent)
            : 0;
        uint amountWithoutFee = amount.sub(fee);

        _secureTokenTransfer(token, exchanger, amountWithoutFee);
        _secureTokenTransfer(token, serviceWallet(), fee);

        listedToken.tokensForSaleAmount = listedToken.tokensForSaleAmount.add(amountWithoutFee);

        if (exchanger.getWTokenByToken(tokenAddress) == address(0)) {
            WToken wToken = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);

            exchanger.addTokenToListing(ERC20(tokenAddress), wToken);
        }

        emit TokenPlaced(tokenAddress, msg.sender, amountWithoutFee, exchanger.getWTokenByToken(tokenAddress));
    }

    /**
     * @dev Securely transfer token from sender to account
     */
    function _secureTokenTransfer(ERC20 token, address to, uint value) internal {
        // check for overflow before. we are not sure that the placed token has implemented safe math
        uint expectedBalance = token.balanceOf(to).add(value);

        token.transferFrom(msg.sender, to, value);

        // check balance to be sure it was filled correctly
        assert(token.balanceOf(to) == expectedBalance);
    }

    function initCrowdsale(address tokenAddress, uint amountForSale, uint price) external nonReentrant {
        require(serviceWallet() != address(0));
        require(getApprovedToken(tokenAddress, msg.sender).approvedOwners[msg.sender] == true);
        require(getApprovedToken(tokenAddress, msg.sender).tokensForSaleAmount >= getApprovedToken(tokenAddress, msg.sender).wTokensIssuedAmount.add(amountForSale));
        require(getApprovedToken(tokenAddress, msg.sender).crowdsaleAddress == address(0));

        WToken wtoken = exchanger.getWTokenByToken(tokenAddress);

        IW12Crowdsale crowdsale = factory.createCrowdsale(
            address(tokenAddress),
            address(wtoken),
            price,
            serviceWallet(),
            getApprovedToken(tokenAddress, msg.sender).ethFeePercent,
            getApprovedToken(tokenAddress, msg.sender).WTokenSaleFeePercent,
            getApprovedToken(tokenAddress, msg.sender).trancheFeePercent,
            address(exchanger),
            msg.sender
        );

        getApprovedToken(tokenAddress, msg.sender).crowdsaleAddress = crowdsale;
        wtoken.addTrustedAccount(crowdsale);

        if (getApprovedToken(tokenAddress, msg.sender).WTokenSaleFeePercent > 0) {
            exchanger.approve(
                ERC20(tokenAddress),
                address(crowdsale),
                getApprovedToken(tokenAddress, msg.sender).tokensForSaleAmount
                    .percent(getApprovedToken(tokenAddress, msg.sender).WTokenSaleFeePercent)
            );
        }

        addTokensToCrowdsale(tokenAddress, amountForSale);

        emit CrowdsaleInitialized(tokenAddress, msg.sender, amountForSale);
    }

    function addTokensToCrowdsale(address tokenAddress, uint amountForSale) public {
        require(amountForSale > 0);
        require(tokenAddress != address(0));
        require(exchanger.getWTokenByToken(tokenAddress) != address(0));
        require(getApprovedToken(tokenAddress, msg.sender).crowdsaleAddress != address(0));
        require(getApprovedToken(tokenAddress, msg.sender).approvedOwners[msg.sender] == true);
        require(getApprovedToken(tokenAddress, msg.sender).tokensForSaleAmount >= getApprovedToken(tokenAddress, msg.sender).wTokensIssuedAmount.add(amountForSale));

        WToken token = exchanger.getWTokenByToken(tokenAddress);
        IW12Crowdsale crowdsale = getApprovedToken(tokenAddress, msg.sender).crowdsaleAddress;

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

    function getExchanger() view external returns (ITokenExchanger) {
        return exchanger;
    }

    function getApprovedToken(address tokenAddress, address ownerAddress) internal view returns (ListedToken storage result) {
        return approvedTokens[approvedTokensIndex[tokenAddress][ownerAddress]];
    }

    function serviceWallet() public view returns(address) {
        return wallets.getWallet(SERVICE_WALLET_ID);
    }
}
