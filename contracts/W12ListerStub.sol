pragma solidity 0.4.24;

import "./W12Lister.sol";
import "./crowdsale/factories/IW12CrowdsaleFactory.sol";
import "./wallets/IWallets.sol";
import "./token/exchanger/ITokenExchanger.sol";



contract W12ListerStub is W12Lister {



    /**
    * @dev Allows for any account besides the owner.
    */
    modifier onlyPrimary() {
        _;
    }

    modifier onlyAdmin {
        _;
    }

    constructor (
        uint version,
        IWallets _wallets,
        IW12CrowdsaleFactory _factory,
        ITokenExchanger _exchanger,
        IListerFactory _lister_factory
    )
        W12Lister(
            version,
            _wallets,
            _factory,
            _exchanger,
            _lister_factory
        ) public
    {}
}
