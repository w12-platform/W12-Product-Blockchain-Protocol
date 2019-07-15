pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Secondary.sol";


contract Wallets is Secondary {
    uint8 constant public SERVICE_WALLET_ID = 1;

    mapping (uint8 => address) private _wallets;

    event NewWallet(uint8 indexed id, address wallet);

    constructor() public {
        setWallet(SERVICE_WALLET_ID, msg.sender);
    }

    function setWallet(uint8 id, address wallet) public onlyPrimary {
        _wallets[id] = wallet;

        emit NewWallet(id, wallet);
    }

    function getWallet(uint8 id) public view returns(address) {
        return _wallets[id];
    }
}
