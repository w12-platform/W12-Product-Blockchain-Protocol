pragma solidity 0.4.24;

import "../IW12Crowdsale.sol";


interface IW12CrowdsaleFactory2 {
    	function create(
	address tokenAddress,
	address wTokenAddress,
	uint price,
	address serviceWallet,
	address swap,
	uint serviceFee,
	uint WTokenSaleFeePercent,
	address fund,
	address rates
	) public returns (address);
}
