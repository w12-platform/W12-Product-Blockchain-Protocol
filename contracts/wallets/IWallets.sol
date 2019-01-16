pragma solidity 0.4.24;


contract IWallets {
    function setWallet(uint8 id, address wallet) public;

    function getWallet(uint8 id) public view returns(address);
}
