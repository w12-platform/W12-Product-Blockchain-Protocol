pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./IWToken.sol";


contract WToken is IWToken, Ownable {
    using SafeMath for uint256;

    mapping (address => mapping (address => uint256)) internal allowed;

    mapping(address => uint256) public balances;

    uint256 private _totalSupply;

    mapping (address => mapping (uint256 => uint256)) public vestingBalanceOf;

    mapping (address => uint[]) vestingTimes;

    mapping (address => bool) trustedAccounts;

    event VestingTransfer(address from, address to, uint256 value, uint256 agingTime);
    event Burn(address indexed burner, uint256 value);

    /**
    * @dev total number of tokens in existence
    */
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    constructor(string _name, string _symbol, uint8 _decimals) DetailedERC20(_name, _symbol, _decimals) public {
        trustedAccounts[msg.sender] = true;
    }

    /**
    * @dev transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        _checkMyVesting(msg.sender);
        require(_to != address(0));
        require(_value <= accountBalance(msg.sender));

        balances[msg.sender] = balances[msg.sender].sub(_value);

        balances[_to] = balances[_to].add(_value);

        emit Transfer(msg.sender, _to, _value);

        return true;
    }

    function vestingTransfer(address _to, uint256 _value, uint32 _vestingTime) external onlyTrusted(msg.sender) returns (bool) {
        transfer(_to, _value);

        if (_vestingTime > now) {
            _addToVesting(address(0), _to, _vestingTime, _value);
        }

        emit VestingTransfer(msg.sender, _to, _value, _vestingTime);

        return true;
    }

    /**
    * @dev Gets the balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balances[_owner];
    }

    /**
    * @dev Transfer tokens from one address to another
    * @param _from address The address which you want to send tokens from
    * @param _to address The address which you want to transfer to
    * @param _value uint256 the amount of tokens to be transferred
    */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        _checkMyVesting(_from);

        require(_to != address(0));
        require(_value <= accountBalance(_from));
        require(_value <= allowed[_from][msg.sender]);

        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);

        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
    * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
    *
    * Beware that changing an allowance with this method brings the risk that someone may use both the old
    * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
    * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
    * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    * @param _spender The address which will spend the funds.
    * @param _value The amount of tokens to be spent.
    */
    function approve(address _spender, uint256 _value) public returns (bool) {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);

        return true;
    }

    /**
    * @dev Function to check the amount of tokens that an owner allowed to a spender.
    * @param _owner address The address which owns the funds.
    * @param _spender address The address which will spend the funds.
    * @return A uint256 specifying the amount of tokens still available for the spender.
    */
    function allowance(address _owner, address _spender) public view returns (uint256) {
        return allowed[_owner][_spender];
    }

    /**
    * @dev Increase the amount of tokens that an owner allowed to a spender.
    *
    * approve should be called when allowed[_spender] == 0. To increment
    * allowed value is better to use this function to avoid 2 calls (and wait until
    * the first transaction is mined)
    * From MonolithDAO Token.sol
    * @param _spender The address which will spend the funds.
    * @param _addedValue The amount of tokens to increase the allowance by.
    */
    function increaseApproval(address _spender, uint _addedValue) public returns (bool) {
        allowed[msg.sender][_spender] = allowed[msg.sender][_spender].add(_addedValue);
        emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);

        return true;
    }

    /**
    * @dev Decrease the amount of tokens that an owner allowed to a spender.
    *
    * approve should be called when allowed[_spender] == 0. To decrement
    * allowed value is better to use this function to avoid 2 calls (and wait until
    * the first transaction is mined)
    * From MonolithDAO Token.sol
    * @param _spender The address which will spend the funds.
    * @param _subtractedValue The amount of tokens to decrease the allowance by.
    */
    function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool) {
        uint oldValue = allowed[msg.sender][_spender];
        if (_subtractedValue >= oldValue) {
            allowed[msg.sender][_spender] = 0;
        } else {
            allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
        }
        emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);

        return true;
    }

    function mint(address _to, uint _amount, uint32 _vestingTime) external onlyTrusted(msg.sender) returns (bool) {
        balances[_to] = balances[_to].add(_amount);
        _totalSupply = _totalSupply.add(_amount);

        if (_vestingTime > now) {
            _addToVesting(address(0), _to, _vestingTime, _amount);
        }

        emit Transfer(address(0), _to, _amount);
        emit VestingTransfer(address(0), _to, _amount, _vestingTime);

        return true;
    }

    function _addToVesting(address _from, address _to, uint256 _vestingTime, uint256 _amount) internal {
        vestingBalanceOf[_to][0] = vestingBalanceOf[_to][0].add(_amount);

        if(vestingBalanceOf[_to][_vestingTime] == 0)
            vestingTimes[_to].push(_vestingTime);

        vestingBalanceOf[_to][_vestingTime] = vestingBalanceOf[_to][_vestingTime].add(_amount);
    }

    /**
      * @dev Burns a specific amount of tokens.
      * @param _value The amount of token to be burned.
      */
    function burn(uint256 _value) public {
        _burn(msg.sender, _value);
    }

    /**
     * @dev Burns a specific amount of tokens from the target address and decrements allowance
     * @param _from address The address which you want to send tokens from
     * @param _value uint256 The amount of token to be burned
     */
    function burnFrom(address _from, uint256 _value) public {
        require(_value <= allowed[_from][msg.sender]);
        // Should https://github.com/OpenZeppelin/zeppelin-solidity/issues/707 be accepted,
        // this function needs to emit an event with the updated approval.
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        _burn(_from, _value);
    }

    function _burn(address _who, uint256 _value) internal {
        _checkMyVesting(_who);

        require(_value <= accountBalance(_who));
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure

        balances[_who] = balances[_who].sub(_value);
        _totalSupply = _totalSupply.sub(_value);
        emit Burn(_who, _value);
        emit Transfer(_who, address(0), _value);
    }

    function _checkMyVesting(address _from) internal {
        if (vestingBalanceOf[_from][0] == 0) return;

        for (uint256 k = 0; k < vestingTimes[_from].length; k++) {
            if (vestingTimes[_from][k] < now) {
                vestingBalanceOf[_from][0] = vestingBalanceOf[_from][0]
                    .sub(vestingBalanceOf[_from][vestingTimes[_from][k]]);
                vestingBalanceOf[_from][vestingTimes[_from][k]] = 0;
            }
        }
    }

    function accountBalance(address _address) public view returns (uint256 balance) {
        balance = balances[_address];

        if (vestingBalanceOf[_address][0] == 0) return;

        for (uint256 k = 0; k < vestingTimes[_address].length; k++) {
            if (vestingTimes[_address][k] >= now) {
                balance = balance.sub(vestingBalanceOf[_address][vestingTimes[_address][k]]);
            }
        }
    }

    function addTrustedAccount(address caller) external onlyOwner {
        trustedAccounts[caller] = true;
    }

    function removeTrustedAccount(address caller) external onlyOwner {
        trustedAccounts[caller] = false;
    }

    modifier onlyTrusted(address caller) {
        require(trustedAccounts[caller]);
        _;
    }
}
