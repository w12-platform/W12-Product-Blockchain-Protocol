pragma solidity 0.4.24;

import "../../crowdsale/IW12Crowdsale.sol";
import "../../crowdsale/factories/IW12CrowdsaleFactory.sol";
import "./W12Lister__W12CrowdsaleMock.sol";


contract W12Lister__W12CrowdsaleFactoryMock is IW12CrowdsaleFactory {
    struct CreateCrowdsaleCall {
        address tokenAddress;
        address _wTokenAddress;
        uint price;
        address serviceWallet;
        uint serviceFee;
        uint WTokenSaleFeePercent;
        uint trancheFeePercent;
        address swap;
        address[] owners;
    }

    CreateCrowdsaleCall __createCrowdsaleCall;
    function _createCrowdsaleCall() public view returns(address, address, uint, address, uint, uint, uint, address, address[]) {
        return (
            __createCrowdsaleCall.tokenAddress,
            __createCrowdsaleCall._wTokenAddress,
            __createCrowdsaleCall.price,
            __createCrowdsaleCall.serviceWallet,
            __createCrowdsaleCall.serviceFee,
            __createCrowdsaleCall.WTokenSaleFeePercent,
            __createCrowdsaleCall.trancheFeePercent,
            __createCrowdsaleCall.swap,
            __createCrowdsaleCall.owners
        );
    }

    function createCrowdsale(
        address tokenAddress,
        address _wTokenAddress,
        uint price,
        address serviceWallet,
        uint serviceFee,
        uint WTokenSaleFeePercent,
        uint trancheFeePercent,
        address swap,
        address[] owners
    )
     external returns (IW12Crowdsale) {
        __createCrowdsaleCall.tokenAddress = tokenAddress;
        __createCrowdsaleCall._wTokenAddress = _wTokenAddress;
        __createCrowdsaleCall.price = price;
        __createCrowdsaleCall.serviceWallet = serviceWallet;
        __createCrowdsaleCall.serviceFee = serviceFee;
        __createCrowdsaleCall.WTokenSaleFeePercent = WTokenSaleFeePercent;
        __createCrowdsaleCall.trancheFeePercent = trancheFeePercent;
        __createCrowdsaleCall.swap = swap;
        __createCrowdsaleCall.owners = owners;

        return new W12Lister__W12CrowdsaleMock();
    }
}
