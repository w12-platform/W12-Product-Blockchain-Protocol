pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../access/roles/IAdminRole.sol";

contract IWToken is IERC20, IAdminRole {
    function vestingBalanceOf(address _address, uint _date) public view returns (uint);

    function vestingTransfer(address _to, uint256 _value, uint32 _vestingTime) external returns (bool);

    function increaseApproval(address _spender, uint _addedValue) public returns (bool);

    function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool);

    function mint(address _to, uint _amount, uint32 _vestingTime) external returns (bool);

    function burn(uint256 _value) public;

    function burnFrom(address _from, uint256 _value) public;

    function accountBalance(address _address) public view returns (uint256 balance);

    function name() public view returns (string);

    function symbol() public view returns (string);

    function decimals() public view returns (uint8);
}
