pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./crowdsale/factories/IW12CrowdsaleFactory.sol";
import "./wallets/IWallets.sol";
import "./access/roles/IAdminRole.sol";
import "./token/IWToken.sol";
import "./libs/Percent.sol";
import "./token/WToken.sol";
import "./token/exchanger/ITokenExchanger.sol";
import "./versioning/Versionable.sol";
import "./access/roles/AdminRole.sol";
import "./libs/TokenListing.sol";


contract W12Lister is IAdminRole, AdminRole, Versionable, Secondary, ReentrancyGuard {
    using SafeMath for uint;
    using Percent for uint;
    using TokenListing for TokenListing.Whitelist;

    uint8 constant SERVICE_WALLET_ID = 1;

    ITokenExchanger public exchanger;
    IW12CrowdsaleFactory public factory;
    IWallets public wallets;

    TokenListing.Whitelist whitelist;

    event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner);
    event TokenWhitelisted(address indexed token, address indexed sender, address[] owners, string name, string symbol);
    event TokenPlaced(address indexed originalToken, address indexed sender, address crowdsale, uint tokenAmount, address placedToken);
    event CrowdsaleInitialized(address indexed token, address indexed sender, address crowdsale, uint amountForSale);
    event CrowdsaleTokenMinted(address indexed token, address indexed sender, address crowdsale, uint amount);

    constructor(
        uint version,
        IWallets _wallets,
        IW12CrowdsaleFactory _factory,
        ITokenExchanger _exchanger
    ) Versionable(version) public {
        require(_wallets != address(0));
        require(_factory != address(0));
        require(_exchanger != address(0));

        exchanger = _exchanger;
        wallets = _wallets;
        factory = _factory;
    }

    function addAdmin(address _account) public onlyPrimary {
        _addAdmin(_account);
    }

    function removeAdmin(address _account) public onlyPrimary {
        _removeAdmin(_account);
    }

    function whitelistToken(
        address token,
        string name,
        string symbol,
        uint8 decimals,
        address[] owners,
        uint feePercent,
        uint ethFeePercent,
        uint WTokenSaleFeePercent,
        uint trancheFeePercent
    )
        external onlyAdmin
    {
        whitelist.addOrUpdate(
            token,
            name,
            symbol,
            decimals,
            owners,
            feePercent,
            ethFeePercent,
            WTokenSaleFeePercent,
            trancheFeePercent
        );

        emit TokenWhitelisted(token, msg.sender, owners, name, symbol);
    }

    /**
     * @notice Place token for sale
     * @param token Token address
     * @param crowdsale Crowdsale address
     * @param amount Token amount to place
     */
    function placeToken(address token, address crowdsale, uint amount) external nonReentrant {
        require(serviceWallet() != address(0));
        require(amount > 0);
        require(whitelist.isTokenWhitelisted(token));
        require(whitelist.hasTokenOwner(token, msg.sender));
        require(whitelist.hasCrowdsaleWithAddress(token, crowdsale));

        TokenListing.WhitelistedToken storage listedToken = whitelist.getToken(token);

        ERC20Detailed tokenInstance = ERC20Detailed(token);

        require(tokenInstance.allowance(msg.sender, address(this)) >= amount);
        require(tokenInstance.decimals() == listedToken.decimals);

        uint fee = listedToken.feePercent > 0
            ? amount.percent(listedToken.feePercent)
            : 0;
        uint amountWithoutFee = amount.sub(fee);

        _secureTokenTransfer(IERC20(tokenInstance), exchanger, amountWithoutFee);
        _secureTokenTransfer(IERC20(tokenInstance), serviceWallet(), fee);

        whitelist.getCrowdsaleByAddress(token, crowdsale).tokensForSaleAmount = whitelist
            .getCrowdsaleByAddress(token, crowdsale)
                .tokensForSaleAmount.add(amountWithoutFee);

        if (address(exchanger.getWTokenByToken(token)) == address(0)) {
            IWToken wToken = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);

            exchanger.addTokenToListing(ERC20Detailed(token), wToken);
        }

        emit TokenPlaced(token, msg.sender, crowdsale, amountWithoutFee, address(exchanger.getWTokenByToken(token)));
    }

    /**
     * @dev Securely transfer token from sender to account
     */
    function _secureTokenTransfer(IERC20 token, address to, uint value) internal {
        // check for overflow before. we are not sure that the placed token has implemented safe math
        uint expectedBalance = token.balanceOf(to).add(value);

        token.transferFrom(msg.sender, to, value);

        // check balance to be sure it was filled correctly
        assert(token.balanceOf(to) == expectedBalance);
    }

    function initCrowdsale(address token, uint amountForSale, uint price) external nonReentrant {
        require(serviceWallet() != address(0));
        require(whitelist.isTokenWhitelisted(token));
        require(whitelist.hasTokenOwner(token, msg.sender));
        require(whitelist.hasNotInitialisedCrowdsale(token));
        require(
            whitelist.getNotInitialisedCrowdsale(token).tokensForSaleAmount
                >= whitelist.getNotInitialisedCrowdsale(token).wTokensIssuedAmount.add(amountForSale)
        );

        TokenListing.WhitelistedToken storage listedToken = whitelist.getToken(token);
        IWToken wtoken = exchanger.getWTokenByToken(listedToken.token);

        IW12Crowdsale crowdsale = factory.createCrowdsale(
            listedToken.token,
            address(wtoken),
            price,
            serviceWallet(),
            listedToken.ethFeePercent,
            listedToken.WTokenSaleFeePercent,
            listedToken.trancheFeePercent,
            address(exchanger),
            listedToken.owners
        );

        crowdsale.addAdmin(msg.sender);
        crowdsale.getFund().addAdmin(msg.sender);
        wtoken.addAdmin(address(crowdsale));

        whitelist.initializeCrowdsale(token, address(crowdsale));

        if (listedToken.WTokenSaleFeePercent > 0) {
            exchanger.approve(
                IERC20(listedToken.token),
                address(crowdsale),
                whitelist.getCrowdsaleByAddress(token, address(crowdsale)).tokensForSaleAmount
                    .percent(listedToken.WTokenSaleFeePercent)
            );
        }

        addTokensToCrowdsale(token, address(crowdsale), amountForSale);

        emit CrowdsaleInitialized(listedToken.token, msg.sender, address(crowdsale), amountForSale);
    }

    function addTokensToCrowdsale(address token, address crowdsale, uint amountForSale) public {
        require(amountForSale > 0);
        require(whitelist.isTokenWhitelisted(token));
        require(whitelist.hasTokenOwner(token, msg.sender));
        require(whitelist.hasCrowdsaleWithAddress(token, crowdsale));
        require(address(exchanger.getWTokenByToken(token)) != address(0));
        require(
            whitelist.getCrowdsaleByAddress(token, crowdsale).tokensForSaleAmount
                >= whitelist.getCrowdsaleByAddress(token, crowdsale).wTokensIssuedAmount.add(amountForSale)
        );

        IWToken wtoken = exchanger.getWTokenByToken(token);

        whitelist.getCrowdsaleByAddress(token, crowdsale).wTokensIssuedAmount = whitelist
            .getCrowdsaleByAddress(token, crowdsale)
                .wTokensIssuedAmount.add(amountForSale);

        wtoken.mint(crowdsale, amountForSale, 0);

        emit CrowdsaleTokenMinted(token, msg.sender, address(crowdsale), amountForSale);
    }

    function getTokenOwners(address token) external view returns (address[]) {
        return whitelist.getToken(token).owners;
    }

    function getCrowdsaleOwners(address token, address crowdsale) external view returns (address[]) {
        return whitelist.getCrowdsaleByAddress(token, crowdsale).owners;
    }

    function getExchanger() view external returns (ITokenExchanger) {
        return exchanger;
    }

    function getToken(address token)
        external view returns (string name, string symbol, uint8 decimals, address[] owners, uint[4] commissions)
    {
        require(whitelist.isTokenWhitelisted(token));

        name = whitelist.getToken(token).name;
        symbol = whitelist.getToken(token).symbol;
        decimals = whitelist.getToken(token).decimals;
        owners = whitelist.getToken(token).owners;
        commissions[0] = whitelist.getToken(token).feePercent;
        commissions[1] = whitelist.getToken(token).ethFeePercent;
        commissions[2] = whitelist.getToken(token).WTokenSaleFeePercent;
        commissions[3] = whitelist.getToken(token).trancheFeePercent;
    }

    function getTokens() external view returns (address[]) {
        address[] memory result = new address[](whitelist.getTokens().length);

        for (uint i = 0; i < whitelist.getTokens().length; i++) {
            result[i] = whitelist.getTokens()[i].token;
        }

        return result;
    }

    function isTokenWhitelisted(address token) external view returns (bool) {
        return whitelist.isTokenWhitelisted(token);
    }

    function hasTokenOwner(address token, address owner) external view returns (bool) {
        return whitelist.hasTokenOwner(token, owner);
    }

    function getCrowdsales(address token) external view returns (address[]) {
        address[] memory result = new address[](whitelist.getCrowdsales(token).length);

        for (uint i = 0; i < whitelist.getCrowdsales(token).length; i++) {
            result[i] = whitelist.getCrowdsales(token)[i].crowdsale;
        }

        return result;
    }

    function hasCrowdsaleWithAddress(address token, address crowdsale) external view returns (bool) {
        return whitelist.hasCrowdsaleWithAddress(token, crowdsale);
    }

    function hasNotInitialisedCrowdsale(address token) public view returns (bool) {
        return whitelist.hasNotInitialisedCrowdsale(token);
    }

    function getCrowdsale(address token, address crowdsale)
        external view returns (uint[4] commissions, uint[2] amounts, address[] owners)
    {
        require(whitelist.hasCrowdsaleWithAddress(token, crowdsale));

        commissions[0] = whitelist.getCrowdsaleByAddress(token, crowdsale).feePercent;
        commissions[1] = whitelist.getCrowdsaleByAddress(token, crowdsale).ethFeePercent;
        commissions[2] = whitelist.getCrowdsaleByAddress(token, crowdsale).WTokenSaleFeePercent;
        commissions[3] = whitelist.getCrowdsaleByAddress(token, crowdsale).trancheFeePercent;
        amounts[0] = whitelist.getCrowdsaleByAddress(token, crowdsale).tokensForSaleAmount;
        amounts[1] = whitelist.getCrowdsaleByAddress(token, crowdsale).wTokensIssuedAmount;
        owners = whitelist.getCrowdsaleByAddress(token, crowdsale).owners;
    }

    function serviceWallet() public view returns(address) {
        return wallets.getWallet(SERVICE_WALLET_ID);
    }
}
