pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./crowdsale/factories/IW12CrowdsaleFactory.sol";
import "./wallets/IWallets.sol";
import "./access/roles/IAdminRole.sol";
import "./token/IWToken.sol";
import "./libs/Percent.sol";
import "./token/WToken.sol";
import "./token/exchanger/ITokenExchanger.sol";
import "./libs/TokenListing.sol";


contract ListerFactory
{
	using SafeMath for uint;


	address token;

	ERC20Detailed tokenInstance;

	TokenListing.WhitelistedToken listedToken;


	event TokenPlaced(address indexed originalToken, address indexed sender, address crowdsale, uint tokenAmount, address placedToken);


	constructor()
	{
	}

	function placeToken1(address _token) public returns(ERC20Detailed)
	{


		token = _token;

		tokenInstance = ERC20Detailed(token);

		return tokenInstance;
	}


	function placeToken2(uint amount, ITokenExchanger exchanger, uint amountWithoutFee, address service_wallet, uint fee) public
	{
		require(service_wallet != address(0));
		require(amount > 0);

		_secureTokenTransfer(IERC20(tokenInstance), exchanger, amountWithoutFee);
		_secureTokenTransfer(IERC20(tokenInstance), service_wallet, fee);
	}


	function placeToken3(address crowdsale, ITokenExchanger exchanger, address snd, uint amountWithoutFee, string name, string symbol, uint8 decimals) public
	{
		if (address(exchanger.getWTokenByToken(token)) == address(0))
		{
			IWToken wToken = new WToken(name, symbol, decimals);

			exchanger.addTokenToListing(ERC20Detailed(token), wToken);
		}

		emit TokenPlaced(token, snd, crowdsale, amountWithoutFee, address(exchanger.getWTokenByToken(token)));
	}

	/**
 * @dev Securely transfer token from sender to account
 */
	function _secureTokenTransfer(IERC20 token, address to, uint value) internal
	{
				// check for overflow before. we are not sure that the placed token has implemented safe math
				uint expectedBalance = token.balanceOf(to).add(value);

				token.transferFrom(msg.sender, to, value);

				// check balance to be sure it was filled correctly
				assert(token.balanceOf(to) == expectedBalance);
	}

	function addTokensToCrowdsale(address token, address crowdsale, uint amountForSale, ITokenExchanger exchanger) public
	{
		require(amountForSale > 0);
		require(address(exchanger.getWTokenByToken(token)) != address(0));

		IWToken wtoken = exchanger.getWTokenByToken(token);

		whitelist.getCrowdsaleByAddress(token, crowdsale).wTokensIssuedAmount = whitelist
		.getCrowdsaleByAddress(token, crowdsale)
		.wTokensIssuedAmount.add(amountForSale);

		wtoken.mint(crowdsale, amountForSale, 0);

		emit CrowdsaleTokenMinted(token, msg.sender, address(crowdsale), amountForSale);
	}


}
