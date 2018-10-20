pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../../rates/IRates.sol";
import "../../crowdsale/W12Fund.sol";
import "../../token/IWToken.sol";


contract W12FundStub is W12Fund {
    constructor (
        uint version,
        address crowdsaleAddress,
        address swapAddress,
        address wTokenAddress,
        address _serviceWallet,
        uint _trancheFeePercent,
        IRates _rates
    )
        W12Fund(version, _trancheFeePercent, _rates) public
    {
        crowdsale = IW12Crowdsale(crowdsaleAddress);
        swap = swapAddress;
        wToken = IWToken(wTokenAddress);
        trancheFeePercent = _trancheFeePercent;
        serviceWallet = _serviceWallet;
    }

//    function _setTotalFunded(uint amount) external {
//        totalFunded = amount;
//    }
//
//    function _setTotalRefunded(uint amount) external {
//        totalRefunded = amount;
//    }

    function() payable external {}

    function _outFunds(bytes32 _symbol, uint _amount) external {
        if (_symbol == METHOD_ETH) {
            require(address(this).balance >= _amount);
            msg.sender.transfer(_amount);
        } else if(_symbol != METHOD_USD) {
            require(rates.isToken(_symbol));
            require(ERC20(rates.getTokenAddress(_symbol)).balanceOf(address(this)) >= _amount);
            require(ERC20(rates.getTokenAddress(_symbol)).transfer(msg.sender, _amount));
        }
    }

    // allow any sender
    modifier onlyFrom(address sender) {
        _;
    }
}
