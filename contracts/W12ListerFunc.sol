pragma solidity 0.4.24;


import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./crowdsale/factories/IW12CrowdsaleFactory.sol";
import "./wallets/IWallets.sol";
import "./access/roles/IAdminRole.sol";
import "./token/IWToken.sol";
import "./libs/Percent.sol";
import "./token/exchanger/ITokenExchanger.sol";
import "./versioning/Versionable.sol";
import "./access/roles/AdminRole.sol";
import "./libs/TokenListing.sol";
import "./IListerFactory.sol";


contract W12Lister is IAdminRole, AdminRole, Versionable, Secondary, ReentrancyGuard {
	using SafeMath for uint;
	using Percent for uint;
	using TokenListing for TokenListing.Whitelist;

	uint8 constant SERVICE_WALLET_ID = 1;

	ITokenExchanger public exchanger;
	IW12CrowdsaleFactory public factory;
	IWallets public wallets;

	TokenListing.Whitelist whitelist;

	IListerFactory public lister_factory;

	event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner);
	event TokenWhitelisted(address indexed token, address indexed sender, address[] owners);
	event CrowdsaleInitialized(address indexed token, address indexed sender, address crowdsale, uint amountForSale);
	event CrowdsaleTokenMinted(address indexed token, address indexed sender, address crowdsale, uint amount);

	constructor(
		uint version,
		IWallets _wallets,
		IW12CrowdsaleFactory _factory,
		ITokenExchanger _exchanger,
		IListerFactory _lister_factory
	) Versionable(version) public {
		require(_wallets != address(0));
		require(_factory != address(0));
		require(_exchanger != address(0));

		exchanger = _exchanger;
		wallets = _wallets;
		factory = _factory;
		lister_factory = _lister_factory;
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
		uint[4] commissions, // [feePercent, ethFeePercent, WTokenSaleFeePercent, trancheFeePercent]
		bytes32[] paymentMethods,
		uint[] paymentMethodsPurchaseFee
	)
	external onlyAdmin
	{
		whitelist.addOrUpdate(
			token,
			name,
			symbol,
			decimals,
			owners,
			commissions,
			paymentMethods,
			paymentMethodsPurchaseFee
		);

		emit TokenWhitelisted(token, msg.sender, owners);
	}

	/**
	 * @notice Place token for sale
	 * @param token Token address
	 * @param crowdsale Crowdsale address
	 * @param amount Token amount to place
	 */
	function placeToken(address token, address crowdsale, uint amount) external nonReentrant {
		require(whitelist.isTokenWhitelisted(token));
		require(whitelist.hasTokenOwner(token, msg.sender));
		require(whitelist.hasCrowdsaleWithAddress(token, crowdsale));

		TokenListing.WhitelistedToken storage listedToken = whitelist.getToken(token);

		ERC20Detailed tokenInstance = lister_factory.placeToken1(token);

		require(tokenInstance.allowance(msg.sender, address(this)) >= amount);
		require(tokenInstance.decimals() == listedToken.decimals);

		uint fee = listedToken.feePercent > 0
		? amount.percent(listedToken.feePercent)
		: 0;
		uint amountWithoutFee = amount.sub(fee);

//		_secureTokenTransfer(IERC20(tokenInstance), exchanger, amountWithoutFee);
//		_secureTokenTransfer(IERC20(tokenInstance), serviceWallet(), fee);
		lister_factory.placeToken2(amount, exchanger, amountWithoutFee, serviceWallet(), fee);

		whitelist.getCrowdsaleByAddress(token, crowdsale).tokensForSaleAmount = whitelist
		.getCrowdsaleByAddress(token, crowdsale)
		.tokensForSaleAmount.add(amountWithoutFee);

		lister_factory.placeToken3(crowdsale, exchanger, msg.sender, amountWithoutFee, listedToken.name, listedToken.symbol, listedToken.decimals);
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
		_setPaymentMethodPurchaseFeeForCrowdsale(crowdsale, listedToken);

		// give approve to spend entire tokens sale amount because there may be
		// individual purchase fee value for a payment method and it may be changed in the future.
		exchanger.approve(
			IERC20(listedToken.token),
			address(crowdsale),
			whitelist.getCrowdsaleByAddress(token, address(crowdsale)).tokensForSaleAmount
		);

		addTokensToCrowdsale(token, address(crowdsale), amountForSale);

		emit CrowdsaleInitialized(listedToken.token, msg.sender, address(crowdsale), amountForSale);
	}
}
