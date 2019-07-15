pragma solidity ^0.4.24;
import "../crowdsale/W12Crowdsale.sol";
import "../crowdsale/IW12Fund.sol";
import "../rates/IRates.sol";


library W12CrowdsaleLib
{
	function createCrowdsale(
				uint version,
        address _originToken,
        address _token,
        uint _price,
        address _serviceWallet,
        address _swap,
        uint _serviceFee,
        uint _wTokenSaleFeePercent,
        IW12Fund _fund,
        IRates _rates) public returns(W12Crowdsale result)
	{

	}
}
