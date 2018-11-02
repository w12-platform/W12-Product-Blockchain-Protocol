pragma solidity ^0.4.24;

contract IWallets {
    function setWallet(uint8 ID, address wallet);

    function getWallet(uint8 ID) public view returns(address);
}
