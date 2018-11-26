pragma solidity ^0.4.24;

//import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";

contract ERC20Mock is ERC20Detailed, ERC20Mintable, ERC20Burnable {
    constructor(string name, string symbol, uint8 decimals) ERC20Detailed(name, symbol, decimals) public {}

    modifier onlyMinter {
        _;
    }
}
