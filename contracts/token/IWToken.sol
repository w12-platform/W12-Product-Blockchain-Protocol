pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";

contract IWToken is DetailedERC20 {
    mapping(address => uint256) public balances;
    mapping(address => mapping(uint256 => uint256)) public vestingBalanceOf;

    function vestingTransfer(address _to, uint256 _value, uint32 _vestingTime) external returns (bool);

    function increaseApproval(address _spender, uint _addedValue) public returns (bool);

    function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool);

    function mint(address _to, uint _amount, uint32 _vestingTime) external returns (bool);

    function burn(uint256 _value) public;

    function burnFrom(address _from, uint256 _value) public;

    function accountBalance(address _address) public view returns (uint256 balance);

    function addTrustedAccount(address caller) external;

    function removeTrustedAccount(address caller) external;
}
