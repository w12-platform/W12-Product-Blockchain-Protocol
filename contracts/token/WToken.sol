pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./IWToken.sol";
import "../access/roles/Admin.sol";
import "../access/roles/IAdminRole.sol";

contract WToken is IWToken, AdminRole, ERC20Detailed, ERC20, Secondary {
    using SafeMath for uint256;

    mapping (address => mapping (uint256 => uint256)) private _vestingBalanceOf;

    mapping (address => uint[]) private _vestingTimes;

    event VestingTransferred(address from, address to, uint256 value, uint256 agingTime);

    constructor(string name, string symbol, uint8 decimals) ERC20Detailed(name, symbol, decimals) public {}

    function transfer(address to, uint256 value) public returns (bool) {
        _checkMyVesting(msg.sender);

        require(to != address(0));
        require(value <= accountBalance(msg.sender));

        return super.transfer(to, value);
    }

    function vestingTransfer(address to, uint256 value, uint32 vestingTime) external onlyAdmin returns (bool) {
        transfer(to, value);

        if (vestingTime > now) {
            _addToVesting(msg.sender, to, vestingTime, value);
        }

        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        _checkMyVesting(from);

        require(to != address(0));
        require(value <= accountBalance(from));

        return super.transferFrom(from, to, value);
    }

    function increaseApproval(address spender, uint addedValue) public returns (bool) {
        return increaseAllowance(spender, addedValue);
    }

    function decreaseApproval(address spender, uint subtractedValue) public returns (bool) {
        return decreaseAllowance(spender, subtractedValue);
    }

    function mint(address to, uint amount, uint32 vestingTime) external onlyAdmin returns (bool) {
        _mint(to, amount);

        if (vestingTime > now) {
            _addToVesting(address(0), to, vestingTime, amount);
        }

        return true;
    }

    function _addToVesting(address from, address to, uint256 vestingTime, uint256 amount) internal {
        _vestingBalanceOf[to][0] = _vestingBalanceOf[to][0].add(amount);

        if(_vestingBalanceOf[to][vestingTime] == 0) {
            _vestingTimes[to].push(vestingTime);
        }

        _vestingBalanceOf[to][vestingTime] = _vestingBalanceOf[to][vestingTime].add(amount);

        emit VestingTransferred(from, to, amount, vestingTime);
    }

    function burn(uint256 value) public {
        _burn(msg.sender, value);
    }

    function burnFrom(address from, uint256 value) public {
        _burnFrom(from, value);
    }

    function _burnFrom(address account, uint256 value) internal {
        _checkMyVesting(account);

        require(value <= accountBalance(account));

        super._burnFrom(account, value);
    }

    function _burn(address account, uint256 value) internal {
        _checkMyVesting(account);

        require(value <= accountBalance(account));

        super._burn(account, value);
    }

    function _checkMyVesting(address account) internal {
        require(account != address(0));

        if (_vestingBalanceOf[account][0] == 0) return;

        for (uint256 k = 0; k < _vestingTimes[account].length; k++) {
            if (_vestingTimes[account][k] < now) {
                _vestingBalanceOf[account][0] = _vestingBalanceOf[account][0]
                    .sub(_vestingBalanceOf[account][_vestingTimes[account][k]]);
                _vestingBalanceOf[account][_vestingTimes[account][k]] = 0;
            }
        }
    }

    function accountBalance(address account) public view returns (uint256 balance) {
        balance = balanceOf(account);

        if (_vestingBalanceOf[account][0] == 0) return;

        for (uint256 k = 0; k < _vestingTimes[account].length; k++) {
            if (_vestingTimes[account][k] >= now) {
                balance = balance.sub(_vestingBalanceOf[account][_vestingTimes[account][k]]);
            }
        }
    }

    function vestingBalanceOf(address account, uint date) public view returns (uint) {
        return _vestingBalanceOf[account][date];
    }

    function addAdmin(address account) public onlyPrimary {
        _addAdmin(account);
    }

    function removeAdmin(address account) public onlyPrimary {
        _removeAdmin(account);
    }
}
