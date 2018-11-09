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

    event TokenWhitelisted(address indexed token, uint indexed index, address indexed sender, string name, string symbol);
    event TokenPlaced(address indexed originalToken, uint indexed index, address indexed sender, uint tokenAmount, address placedToken);
    event CrowdsaleInitialized(address indexed token, uint indexed index, address indexed sender, uint amountForSale);
    event CrowdsaleTokenMinted(address indexed token, uint indexed index, address indexed sender, uint amount);

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
        uint index = whitelist.add(
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

        emit TokenWhitelisted(token, index, msg.sender, name, symbol);
    }

    /**
     * @notice Place token for sale
     * @param index Token index in whitelist
     * @param amount Token amount to place
     */
    function placeToken(uint index, uint amount) external nonReentrant {
        require(serviceWallet() != address(0));
        require(amount > 0);
        require(whitelist.isExist(index));
        require(whitelist.hasOwner(whitelist.getPointerByIndex(index).token, msg.sender));

        TokenListing.WhitelistedToken storage listedToken = whitelist.getPointerByIndex(index);

        ERC20Detailed token = ERC20Detailed(listedToken.token);

        require(token.allowance(msg.sender, address(this)) >= amount);
        require(token.decimals() == listedToken.decimals);

        uint fee = listedToken.feePercent > 0
            ? amount.percent(listedToken.feePercent)
            : 0;
        uint amountWithoutFee = amount.sub(fee);

        _secureTokenTransfer(IERC20(token), exchanger, amountWithoutFee);
        _secureTokenTransfer(IERC20(token), serviceWallet(), fee);

        listedToken.tokensForSaleAmount = listedToken.tokensForSaleAmount.add(amountWithoutFee);

        if (address(exchanger.getWTokenByToken(listedToken.token)) == address(0)) {
            IWToken wToken = new WToken(listedToken.name, listedToken.symbol, listedToken.decimals);

            exchanger.addTokenToListing(ERC20Detailed(listedToken.token), wToken);
        }

        emit TokenPlaced(listedToken.token, index, msg.sender, amountWithoutFee, address(exchanger.getWTokenByToken(listedToken.token)));
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

    function initCrowdsale(uint index, uint amountForSale, uint price) external nonReentrant {
        require(serviceWallet() != address(0));
        require(whitelist.isExist(index));
        require(whitelist.hasOwner(whitelist.getPointerByIndex(index).token, msg.sender));
        require(whitelist.getCrowdsaleStatus(index) == TokenListing.CrowdsaleStatus.NotInitialized);
        require(
            whitelist.getPointerByIndex(index).tokensForSaleAmount
                >= whitelist.getPointerByIndex(index).wTokensIssuedAmount.add(amountForSale)
        );

        TokenListing.WhitelistedToken storage listedToken = whitelist.getPointerByIndex(index);
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
            whitelist.owners(listedToken.token)
        );

        listedToken.crowdsale = address(crowdsale);
        listedToken.owners = whitelist.owners(listedToken.token);
        wtoken.addAdmin(address(crowdsale));

        if (listedToken.WTokenSaleFeePercent > 0) {
            exchanger.approve(
                IERC20(listedToken.token),
                address(crowdsale),
                listedToken.tokensForSaleAmount
                    .percent(listedToken.WTokenSaleFeePercent)
            );
        }

        addTokensToCrowdsale(index, amountForSale);

        emit CrowdsaleInitialized(listedToken.token, index, msg.sender, amountForSale);
    }

    function addTokensToCrowdsale(uint index, uint amountForSale) public {
        require(amountForSale > 0);
        require(whitelist.isExist(index));
        require(whitelist.hasOwner(whitelist.getPointerByIndex(index).token, msg.sender));
        require(whitelist.getCrowdsaleStatus(index) == TokenListing.CrowdsaleStatus.Initialized);
        require(address(exchanger.getWTokenByToken(whitelist.getPointerByIndex(index).token)) != address(0));
        require(
            whitelist.getPointerByIndex(index).tokensForSaleAmount
                >= whitelist.getPointerByIndex(index).wTokensIssuedAmount.add(amountForSale)
        );

        TokenListing.WhitelistedToken storage listedToken = whitelist.getPointerByIndex(index);
        IWToken token = exchanger.getWTokenByToken(listedToken.token);

        listedToken.wTokensIssuedAmount = listedToken
            .wTokensIssuedAmount.add(amountForSale);

        token.mint(listedToken.crowdsale, amountForSale, 0);

        emit CrowdsaleTokenMinted(listedToken.token, index, msg.sender, amountForSale);
    }

    function getTokenCrowdsale(uint index) view external returns (address) {
        return whitelist.getPointerByIndex(index).crowdsale;
    }

    function getTokenCrowdsaleStatus(uint index) view external returns (TokenListing.CrowdsaleStatus) {
        return whitelist.getCrowdsaleStatus(index);
    }

    function getTokenOwners(address token) public view returns (address[]) {
        return whitelist.owners(token);
    }

    function getExchanger() view external returns (ITokenExchanger) {
        return exchanger;
    }

    function getListedToken(uint index)
        external view returns (string, string, uint8, address[], uint[4], uint[2], address[2])
    {
        require(whitelist.isExist(index));

        uint[4] memory commissions = [
            whitelist.getPointerByIndex(index).feePercent,
            whitelist.getPointerByIndex(index).ethFeePercent,
            whitelist.getPointerByIndex(index).WTokenSaleFeePercent,
            whitelist.getPointerByIndex(index).trancheFeePercent
        ];

        uint[2] memory amounts = [
            whitelist.getPointerByIndex(index).tokensForSaleAmount,
            whitelist.getPointerByIndex(index).wTokensIssuedAmount
        ];

        address[2] memory addresses = [
            whitelist.getPointerByIndex(index).crowdsale,
            whitelist.getPointerByIndex(index).token
        ];

        return (
            whitelist.getPointerByIndex(index).name,
            whitelist.getPointerByIndex(index).symbol,
            whitelist.getPointerByIndex(index).decimals,
            whitelist.getPointerByIndex(index).owners,
            commissions,
            amounts,
            addresses
        );
    }

    function serviceWallet() public view returns(address) {
        return wallets.getWallet(SERVICE_WALLET_ID);
    }
}
