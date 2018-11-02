pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Secondary.sol";

contract Wallets is Secondary {
    uint8 constant public SERVICE_WALLET_ID = 1;

    mapping (uint8 => address) _wallets;

    event NewWallet(uint8 indexed ID, address wallet);

    constructor() public {
        setWallet(SERVICE_WALLET_ID, msg.sender);
    }

    function setWallet(uint8 ID, address wallet) onlyPrimary {
        _wallets[ID] = wallet;

        emit NewWallet(ID, wallet);
    }

    function getWallet(uint8 ID) public view returns(address) {
        return _wallets[ID];
    }
}
