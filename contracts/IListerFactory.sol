pragma solidity ^0.4.24;

import "./token/exchanger/ITokenExchanger.sol";
import "./libs/TokenListing.sol";


contract IListerFactory
{
	function placeToken1(address _token) public returns(ERC20Detailed);
	function placeToken2(uint amount, ITokenExchanger exchanger, uint amountWithoutFee, address service_wallet, uint fee);
	function placeToken3(address crowdsale, ITokenExchanger exchanger, address snd, uint amountWithoutFee, string name, string symbol, uint8 decimals);
}
