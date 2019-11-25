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


contract W12ListerFunc is IAdminRole, AdminRole, Versionable, Secondary, ReentrancyGuard {
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
	 * @dev Securely transfer token from sender to account
	 */
	function _secureTokenTransfer(IERC20 token, address to, uint value) internal {
		// check for overflow before. we are not sure that the placed token has implemented safe math
		uint expectedBalance = token.balanceOf(to).add(value);

		token.transferFrom(msg.sender, to, value);

		// check balance to be sure it was filled correctly
		assert(token.balanceOf(to) == expectedBalance);
	}

	function _setPaymentMethodPurchaseFeeForCrowdsale(IW12Crowdsale crowdsale, TokenListing.WhitelistedToken storage listedToken) private {
		for (uint i = 0; i < listedToken.paymentMethods.length; i++) {
			crowdsale.updatePurchaseFeeParameterForPaymentMethod(
				listedToken.paymentMethods[i],
				true,
				listedToken.paymentMethodsPurchaseFee[i]
			);
		}
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
	external view returns (
		string name,
		string symbol,
		uint8 decimals,
		address[] owners,
		uint[4] commissions,
		bytes32[] paymentMethods,
		uint[] paymentMethodsPurchaseFee
	)
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
		paymentMethods = whitelist.getToken(token).paymentMethods;
		paymentMethodsPurchaseFee = whitelist.getToken(token).paymentMethodsPurchaseFee;
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
	external view returns (
		uint[4] commissions,
		uint[2] amounts,
		address[] owners,
		bytes32[] paymentMethods,
		uint[] paymentMethodsPurchaseFee
	)
	{
		require(whitelist.hasCrowdsaleWithAddress(token, crowdsale));

		commissions[0] = whitelist.getCrowdsaleByAddress(token, crowdsale).feePercent;
		commissions[1] = whitelist.getCrowdsaleByAddress(token, crowdsale).ethFeePercent;
		commissions[2] = whitelist.getCrowdsaleByAddress(token, crowdsale).WTokenSaleFeePercent;
		commissions[3] = whitelist.getCrowdsaleByAddress(token, crowdsale).trancheFeePercent;
		amounts[0] = whitelist.getCrowdsaleByAddress(token, crowdsale).tokensForSaleAmount;
		amounts[1] = whitelist.getCrowdsaleByAddress(token, crowdsale).wTokensIssuedAmount;
		owners = whitelist.getCrowdsaleByAddress(token, crowdsale).owners;
		paymentMethods = whitelist.getCrowdsaleByAddress(token, crowdsale).paymentMethods;
		paymentMethodsPurchaseFee = whitelist.getCrowdsaleByAddress(token, crowdsale).paymentMethodsPurchaseFee;
	}

	function serviceWallet() public view returns (address) {
		return wallets.getWallet(SERVICE_WALLET_ID);
	}
}
