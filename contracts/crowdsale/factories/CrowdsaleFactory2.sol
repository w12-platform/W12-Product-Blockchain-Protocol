pragma solidity ^0.4.0;

import "../W12Crowdsale.sol";
import "../../rates/IRates.sol";
import "../IW12Fund.sol";


contract CrowdsaleFactory2
{
	constructor()
	{

	}


	function create(
	address tokenAddress,
	address wTokenAddress,
	uint price,
	address serviceWallet,
	address swap,
	uint serviceFee,
	uint WTokenSaleFeePercent,
	IW12Fund fund,
	IRates rates
	) public returns (address)
	{
	address result = new W12Crowdsale(
	0,
	tokenAddress,
	wTokenAddress,
	price,
	serviceWallet,
	swap,
	serviceFee,
	WTokenSaleFeePercent,
	fund,
	rates
	);

	return result;

	}

}

