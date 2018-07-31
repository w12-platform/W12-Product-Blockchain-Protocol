pragma solidity ^0.4.13;

contract ReentrancyGuard {

  /**
   * @dev We use a single lock for the whole contract.
   */
  bool private reentrancyLock = false;

  /**
   * @dev Prevents a contract from calling itself, directly or indirectly.
   * @notice If you mark a function `nonReentrant`, you should also
   * mark it `external`. Calling one nonReentrant function from
   * another is not supported. Instead, you can implement a
   * `private` function doing the actual work, and a `external`
   * wrapper marked as `nonReentrant`.
   */
  modifier nonReentrant() {
    require(!reentrancyLock);
    reentrancyLock = true;
    _;
    reentrancyLock = false;
  }

}

library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    if (a == 0) {
      return 0;
    }
    c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return a / b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    assert(c >= a);
    return c;
  }
}

contract Ownable {
  address public owner;


  event OwnershipRenounced(address indexed previousOwner);
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  constructor() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  /**
   * @dev Allows the current owner to relinquish control of the contract.
   */
  function renounceOwnership() public onlyOwner {
    emit OwnershipRenounced(owner);
    owner = address(0);
  }
}

contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender)
    public view returns (uint256);

  function transferFrom(address from, address to, uint256 value)
    public returns (bool);

  function approve(address spender, uint256 value) public returns (bool);
  event Approval(
    address indexed owner,
    address indexed spender,
    uint256 value
  );
}

contract DetailedERC20 is ERC20 {
  string public name;
  string public symbol;
  uint8 public decimals;

  constructor(string _name, string _symbol, uint8 _decimals) public {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
  }
}

interface IW12Crowdsale {
    function setParameters(uint32 _startDate, uint _price, address _serviceWallet) external;

    function setStages(uint32[] stage_endDates, uint8[] stage_discounts, uint32[] stage_vestings) external;

    function setStageVolumeBonuses(uint stage, uint[] volumeBoundaries, uint8[] volumeBonuses) external;

    function getWToken() external view returns(WToken);

    function getCurrentMilestone() external view returns (
        uint32,
        uint8,
        uint32,
        uint32,
        bytes,
        bytes
    );

    function () payable external;
}

interface IW12CrowdsaleFactory {
    function createCrowdsale(address _wTokenAddress, uint32 _startDate, uint price, address serviceWallet, uint8 serviceFee, address swap, address owner) external returns (IW12Crowdsale);
}

contract W12Crowdsale is IW12Crowdsale, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using BytesLib for bytes;

    struct Stage {
        uint32 endDate;
        uint8 discount;
        uint32 vesting;
        uint[] volumeBoundaries;
        uint8[] volumeBonuses;
    }

    struct Milestone {
        uint32 endDate;
        uint8  tranchePercent;
        uint32 voteEndDate;
        uint32 withdrawalWindow;
        bytes name;
        bytes description;
    }

    WToken public token;
    uint tokenDecimals;
    uint32 public startDate;
    uint public price;
    uint8 public serviceFee;
    address public serviceWallet;
    W12Fund public fund;

    Stage[] public stages;
    Milestone[] public milestones;

    event TokenPurchase(address indexed buyer, uint amountPaid, uint tokensBought);
    event StagesUpdated();

    constructor (address _token, uint32 _startDate, uint _price, address _serviceWallet, uint8 _serviceFee, W12Fund _fund) public {
        require(_token != address(0));
        require(_serviceFee >= 0 && _serviceFee < 100);
        require(_fund != address(0));

        token = WToken(_token);
        tokenDecimals = token.decimals();

        __setParameters(_startDate, _price, _serviceWallet);
        serviceFee = _serviceFee;
        fund = _fund;
    }

    function stagesLength() external view returns (uint) {
        return stages.length;
    }

    function milestonesLength() external view returns (uint) {
        return milestones.length;
    }

    function getStageVolumeBoundaries(uint stageNumber) external view returns (uint[]) {
        return stages[stageNumber].volumeBoundaries;
    }

    function getStageVolumeBonuses(uint stageNumber) external view returns (uint8[]) {
        return stages[stageNumber].volumeBonuses;
    }

    function __setParameters(uint32 _startDate, uint _price, address _serviceWallet) internal {
        require(_startDate >= now);
        require(_price > 0);
        require(_serviceWallet != address(0));

        startDate = _startDate;
        price = _price;
        serviceWallet = _serviceWallet;
    }

    function setParameters(uint32 _startDate, uint _price, address _serviceWallet) external onlyOwner {
        __setParameters(_startDate, _price, _serviceWallet);
    }

    function setStages(uint32[] stage_endDates, uint8[] stage_discounts, uint32[] stage_vestings) external onlyOwner {
        require(stage_endDates.length <= uint8(-1));
        require(stage_endDates.length > 0);
        require(stage_endDates.length == stage_discounts.length);
        require(stage_endDates.length == stage_vestings.length);

        uint8 stagesCount = uint8(stage_endDates.length);
        stages.length = stagesCount;

        for(uint8 i = 0; i < stagesCount; i++) {
            require(stage_discounts[i] >= 0 && stage_discounts[i] < 100);
            require(startDate < stage_endDates[i]);
            // Checking that stages entered in historical order
            if(i < stagesCount - 1)
                require(stage_endDates[i] < stage_endDates[i+1], "Stages are not in historical order");

            // Reverting stage order for future use
            stages[stagesCount - i - 1].endDate = stage_endDates[i];
            stages[stagesCount - i - 1].discount = stage_discounts[i];
            stages[stagesCount - i - 1].vesting = stage_vestings[i];
        }

        emit StagesUpdated();
    }

    function setStageVolumeBonuses(uint stage, uint[] volumeBoundaries, uint8[] volumeBonuses) external onlyOwner {
        require(volumeBoundaries.length == volumeBonuses.length);
        require(stage < stages.length);

        delete stages[stage].volumeBoundaries;
        delete stages[stage].volumeBonuses;

        stages[stage].volumeBoundaries = volumeBoundaries;
        stages[stage].volumeBonuses = volumeBonuses;
    }

    function setMilestones(uint32[] dates, uint8[] tranchePercents, uint32[] offsets, bytes namesAndDescriptions) external onlyOwner {
        require(milestones.length == 0);
        require(dates.length <= uint8(-1));
        require(dates.length > 3);
        require(dates.length % 3 == 0);
        require(tranchePercents.length.mul(2) == offsets.length);
        require(tranchePercents.length.mul(3) == dates.length);
        require(namesAndDescriptions.length >= tranchePercents.length * 2);

        uint offset = 0;

        for(uint8 i = 0; i < uint8(dates.length); i += 3) {
            require(dates[i] > now);
            require(dates[i + 1] > now);
            require(dates[i + 2] > now);
            require(offset.add(offsets[i / 3]).add(offsets[i / 3 + 1]) <= namesAndDescriptions.length);
            require(tranchePercents[i / 3] < 100);

            bytes memory name = namesAndDescriptions.slice(offset, offsets[i / 3 * 2]);
            bytes memory description = namesAndDescriptions.slice(offset + offsets[i / 3 * 2], offsets[i / 3 * 2 + 1]);

            require(name.length > 0);
            require(description.length > 0);

            milestones.push(Milestone({
                endDate: dates[i],
                tranchePercent: tranchePercents[i / 3],
                voteEndDate: dates[i + 1],
                withdrawalWindow: dates[i + 2],
                name: name,
                description: description
            }));

            offset += offsets[i / 3] + offsets[i / 3 + 1];
        }
    }

    // returns last milestone if completely ended or active milestone at now
    function getCurrentMilestone() external view returns (
        uint32,
        uint8,
        uint32,
        uint32,
        bytes,
        bytes
    ) {
        if(milestones.length == 0 || startDate > now)
            return (0, 0, 0, 0, new bytes(0), new bytes(0));

        Milestone memory last = milestones[milestones.length - 1];

        if (last.withdrawalWindow < now) {
            return (
                last.endDate,
                last.tranchePercent,
                last.voteEndDate,
                last.withdrawalWindow,
                last.name,
                last.description
            );
        }

        for (uint i = 0; i < milestones.length - 1; i++) {
            if (milestones[i].withdrawalWindow >= now) {
                return (
                    milestones[i].endDate,
                    milestones[i].tranchePercent,
                    milestones[i].voteEndDate,
                    milestones[i].withdrawalWindow,
                    milestones[i].name,
                    milestones[i].description
                );
            }
        }
    }

    function buyTokens() payable nonReentrant public {
        require(msg.value > 0);
        require(startDate <= now);
        require(stages.length > 0);

        (uint8 discount, uint32 vesting, uint8 volumeBonus) = getCurrentStage();

        if(stages.length == 0)
            // return funds if ICO was closed
            msg.sender.transfer(msg.value);

        uint stagePrice = discount > 0 ? price.mul(100 - discount).div(100) : price;

        uint tokenAmount = msg.value
            .mul(100 + volumeBonus)
            .div(stagePrice)
            .mul(10**(tokenDecimals - 2));

        require(token.vestingTransfer(msg.sender, tokenAmount, vesting));

        if(serviceFee > 0)
            serviceWallet.transfer(msg.value.mul(serviceFee).div(100));

        fund.recordPurchase.value(address(this).balance).gas(100000)(msg.sender, tokenAmount);

        emit TokenPurchase(msg.sender, msg.value, tokenAmount);
    }

    function getWToken() external view returns(WToken) {
        return token;
    }

    function getFund() external view returns(W12Fund) {
        return fund;
    }

    function getCurrentStage() internal returns(uint8 discount, uint32 vesting, uint8 volumeBonus) {
        if(stages.length == 0)
            return (0, 0, 0);

        Stage storage lastStage = stages[stages.length - 1];

        if(lastStage.endDate >= now) {
            volumeBonus = 0;
            uint lastLowerBoundary = 0;

            if(lastStage.volumeBoundaries.length > 0)
                for (uint i = 0; i < lastStage.volumeBoundaries.length - 1; i++)
                    if(msg.value >= lastLowerBoundary && msg.value < lastStage.volumeBoundaries[i]) {
                        volumeBonus = lastStage.volumeBonuses[i];
                        break;
                    }
                    else
                        lastLowerBoundary = lastStage.volumeBoundaries[i];

            return (lastStage.discount, lastStage.vesting, volumeBonus);
        }

        stages.length--;
        return getCurrentStage();
    }

    function () payable external {
        buyTokens();
    }

    function claimRemainingTokens() external onlyOwner {
        require(stages.length == 0);

        require(token.transfer(owner, token.balanceOf(address(this))));
    }
}

contract W12Fund is Ownable, ReentrancyGuard {
    using SafeMath for uint;

    IW12Crowdsale public crowdsale;
    address public swap;
    WToken public wToken;
    mapping (address=>TokenPriceInfo) public buyers;
    mapping (uint32 => bool) public completedTranches;
    uint public totalFunded;
    uint public totalRefunded;

    struct TokenPriceInfo {
        uint totalBought;
        uint averagePrice;
        uint totalFunded;
    }

    event FundsReceived(address indexed buyer, uint etherAmount, uint tokenAmount);
    event FundsRefunded(address indexed buyer, uint etherAmount, uint tokenAmount);
    event TrancheOperation(address indexed receiver, uint amount);

    function setCrowdsale(IW12Crowdsale _crowdsale) onlyOwner external {
        require(_crowdsale != address(0));

        crowdsale = _crowdsale;
        wToken = _crowdsale.getWToken();
    }

    function setSwap(address _swap) onlyOwner external {
        require(_swap != address(0));

        swap = _swap;
    }

    function getAveragePrice(uint funded, uint tokens) public view returns (uint) {
        uint decimals = wToken.decimals();

        return funded.mul(10 ** decimals).div(tokens);
    }

    function recordPurchase(address buyer, uint tokenAmount) external payable onlyFrom(crowdsale) {
        uint tokensBoughtBefore = buyers[buyer].totalBought;

        buyers[buyer].totalBought = tokensBoughtBefore.add(tokenAmount);
        buyers[buyer].totalFunded = buyers[buyer].totalFunded.add(msg.value);
        buyers[buyer].averagePrice = getAveragePrice(buyers[buyer].totalFunded, buyers[buyer].totalBought);

        totalFunded += msg.value;

        emit FundsReceived(buyer, msg.value, tokenAmount);
    }

    function getInvestmentsInfo(address buyer) external view returns (uint totalTokensBought, uint averageTokenPrice) {
        require(buyer != address(0));

        return (buyers[buyer].totalBought, buyers[buyer].averagePrice);
    }

    /**
        calculation parameters:

            a = address(this).balance
            b = totalFunded
            c = buyers[buyer].totalFunded
            d = buyers[buyer].totalBought
            e = wtokensToRefund

        formula:
            ( ( c * (a / b) ) / d ) * e = (refund amount)

        adapted:
            1. c * b / a = A_1
            2. A_1 * 10 ** 8 / d * e / 10 ** 8
    */
    function getRefundAmount(uint wtokensToRefund) public view returns (uint) {
        uint result = 0;
        uint decimals = wToken.decimals();
        uint max = uint(-1) / 10 ** (decimals + 8);
        address buyer = msg.sender;
        (uint32 start, uint32 end) = getRefundPeriod();

        if (
            start > 0
            && end >= now
            && start < now
            && wtokensToRefund > 0
            && buyers[buyer].totalBought > 0
            && address(this).balance > 0
            && wToken.balanceOf(buyer) >= wtokensToRefund
            && buyers[buyer].totalBought >= wtokensToRefund
        ) {
            uint allowedFund = buyers[buyer].totalFunded.mul(totalFunded).div(address(this).balance);
            uint precisionComponent = allowedFund >= max ? 1 : 10 ** (decimals + 8);

            result = result.add(
                allowedFund
                    .mul(precisionComponent)
                    .div(buyers[buyer].totalBought)
                    .mul(wtokensToRefund)
                    .div(precisionComponent)
            );
        }

        return result;
    }

    function getRefundPeriod() public view returns (uint32, uint32) {
        (,, uint32 voteEndDate, uint32 withdrawalWindow,,) = crowdsale.getCurrentMilestone();

        return (voteEndDate, withdrawalWindow);
    }

    function getTrancheAmount() public view returns (uint) {
        uint result = 0;
        (uint8 tranchePercent, uint32 start, uint32 end) = getTrancheParameters();
        
        bool completed = completedTranches[end];

        if (
            !completed
            && start > 0
            && end >= now
            && start < now
            && tranchePercent > 0
            && address(this).balance > 0
        ) {
            uint allowedFund = totalFunded.sub(totalRefunded);

            result = result.add(
                allowedFund
                .mul(tranchePercent)
                .div(100)
            );
        }

        return result;
    }

    function getTrancheParameters() public view returns (uint8, uint32, uint32) {
        (, uint8 tranchePercent, uint32 voteEndDate, uint32 withdrawalWindow,,) = crowdsale.getCurrentMilestone();

        bool completed = completedTranches[withdrawalWindow];

        if (completed) {
            return (0, 0, 0);
        }

        return (
            tranchePercent,
            voteEndDate,
            withdrawalWindow < now && withdrawalWindow > 0
                ? uint32(-1)
                : withdrawalWindow
        );
    }

    function tranche() external onlyOwner nonReentrant {
        uint trancheAmount = getTrancheAmount();
        (,, uint32 withdrawalWindow) = getTrancheParameters();

        require(trancheAmount > 0);

        completedTranches[withdrawalWindow] = true;

        msg.sender.transfer(trancheAmount);

        emit TrancheOperation(msg.sender, trancheAmount);
    }

    function refund(uint wtokensToRefund) external nonReentrant {
        uint transferAmount = getRefundAmount(wtokensToRefund);
        uint decimals = wToken.decimals();
        address buyer = msg.sender;

        require(transferAmount > 0);
        require(wToken.transferFrom(buyer, swap, wtokensToRefund));

        buyers[buyer].totalBought = buyers[buyer].totalBought
            .sub(wtokensToRefund);
        buyers[buyer].totalFunded = buyers[buyer].totalFunded
            .sub(wtokensToRefund.mul(buyers[buyer].averagePrice).div(10 ** decimals));
        buyers[buyer].averagePrice = buyers[buyer].totalFunded > 0 && buyers[buyer].totalBought > 0
            ? getAveragePrice(buyers[buyer].totalFunded, buyers[buyer].totalBought)
            : 0;

        // update total refunded amount counter
        totalRefunded = totalRefunded.add(transferAmount);

        buyer.transfer(transferAmount);

        emit FundsRefunded(buyer, transferAmount, wtokensToRefund);
    }

    modifier onlyFrom(address sender) {
        require(msg.sender == sender);

        _;
    }
}

contract WToken is DetailedERC20, Ownable {

    mapping (address => mapping (address => uint256)) internal allowed;

    mapping(address => uint256) public balances;

    uint256 private _totalSupply;

    mapping (address => mapping (uint256 => uint256)) public vestingBalanceOf;

    mapping (address => uint[]) vestingTimes;

    mapping (address => bool) trustedAccounts;

    event VestingTransfer(address _from, address _to, uint256 value, uint256 agingTime);

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

        balances[msg.sender] -= _value;

        balances[_to] += _value;

        emit Transfer(msg.sender, _to, _value);

        return true;
    }

    function vestingTransfer(address _to, uint256 _value, uint32 _vestingTime) external onlyTrusted(msg.sender) returns (bool) {
        transfer(_to, _value);

        if (_vestingTime > now) {
            _addToVesting(address(0x0), _to, _vestingTime, _value);
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

        balances[_from] -= _value;
        balances[_to] += _value;
        allowed[_from][msg.sender] -= _value;

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
        allowed[msg.sender][_spender] += _addedValue;
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
            allowed[msg.sender][_spender] = oldValue - _subtractedValue;
        }
        emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);

        return true;
    }

    function mint(address _to, uint _amount, uint32 _vestingTime) external onlyTrusted(msg.sender) returns (bool) {
        require(_totalSupply + _amount > _totalSupply);

        if (_vestingTime > now) {
            _addToVesting(address(0x0), _to, _vestingTime, _amount);
        }

        balances[_to] += _amount;
        _totalSupply += _amount;
        emit Transfer(address(0x0), _to, _amount);

        return true;
    }

    function _addToVesting(address _from, address _to, uint256 _vestingTime, uint256 _amount) internal {
        vestingBalanceOf[_to][0] += _amount;

        if(vestingBalanceOf[_to][_vestingTime] == 0)
            vestingTimes[_to].push(_vestingTime);

        vestingBalanceOf[_to][_vestingTime] += _amount;
        emit VestingTransfer(_from, _to, _amount, _vestingTime);
    }

    function () external {
        revert();
    }

    function _checkMyVesting(address _from) internal {
        if (vestingBalanceOf[_from][0] == 0) return;

        for (uint256 k = 0; k < vestingTimes[_from].length; k++) {
            if (vestingTimes[_from][k] < now) {
                vestingBalanceOf[_from][0] -= vestingBalanceOf[_from][vestingTimes[_from][k]];
                vestingBalanceOf[_from][vestingTimes[_from][k]] = 0;
            }
        }
    }

    function accountBalance(address _address) public view returns (uint256 balance) {
        return balances[_address] - vestingBalanceOf[_address][0];
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

library BytesLib {
    function concat(bytes memory _preBytes, bytes memory _postBytes) internal pure returns (bytes) {
        bytes memory tempBytes;

        assembly {
            // Get a location of some free memory and store it in tempBytes as
            // Solidity does for memory variables.
            tempBytes := mload(0x40)

            // Store the length of the first bytes array at the beginning of
            // the memory for tempBytes.
            let length := mload(_preBytes)
            mstore(tempBytes, length)

            // Maintain a memory counter for the current write location in the
            // temp bytes array by adding the 32 bytes for the array length to
            // the starting location.
            let mc := add(tempBytes, 0x20)
            // Stop copying when the memory counter reaches the length of the
            // first bytes array.
            let end := add(mc, length)

            for {
                // Initialize a copy counter to the start of the _preBytes data,
                // 32 bytes into its memory.
                let cc := add(_preBytes, 0x20)
            } lt(mc, end) {
                // Increase both counters by 32 bytes each iteration.
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                // Write the _preBytes data into the tempBytes memory 32 bytes
                // at a time.
                mstore(mc, mload(cc))
            }

            // Add the length of _postBytes to the current length of tempBytes
            // and store it as the new length in the first 32 bytes of the
            // tempBytes memory.
            length := mload(_postBytes)
            mstore(tempBytes, add(length, mload(tempBytes)))

            // Move the memory counter back from a multiple of 0x20 to the
            // actual end of the _preBytes data.
            mc := end
            // Stop copying when the memory counter reaches the new combined
            // length of the arrays.
            end := add(mc, length)

            for {
                let cc := add(_postBytes, 0x20)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }

            // Update the free-memory pointer by padding our last write location
            // to 32 bytes: add 31 bytes to the end of tempBytes to move to the
            // next 32 byte block, then round down to the nearest multiple of
            // 32. If the sum of the length of the two arrays is zero then add 
            // one before rounding down to leave a blank 32 bytes (the length block with 0).
            mstore(0x40, and(
              add(add(end, iszero(add(length, mload(_preBytes)))), 31),
              not(31) // Round down to the nearest 32 bytes.
            ))
        }

        return tempBytes;
    }

    function concatStorage(bytes storage _preBytes, bytes memory _postBytes) internal {
        assembly {
            // Read the first 32 bytes of _preBytes storage, which is the length
            // of the array. (We don't need to use the offset into the slot
            // because arrays use the entire slot.)
            let fslot := sload(_preBytes_slot)
            // Arrays of 31 bytes or less have an even value in their slot,
            // while longer arrays have an odd value. The actual length is
            // the slot divided by two for odd values, and the lowest order
            // byte divided by two for even values.
            // If the slot is even, bitwise and the slot with 255 and divide by
            // two to get the length. If the slot is odd, bitwise and the slot
            // with -1 and divide by two.
            let slength := div(and(fslot, sub(mul(0x100, iszero(and(fslot, 1))), 1)), 2)
            let mlength := mload(_postBytes)
            let newlength := add(slength, mlength)
            // slength can contain both the length and contents of the array
            // if length < 32 bytes so let's prepare for that
            // v. http://solidity.readthedocs.io/en/latest/miscellaneous.html#layout-of-state-variables-in-storage
            switch add(lt(slength, 32), lt(newlength, 32))
            case 2 {
                // Since the new array still fits in the slot, we just need to
                // update the contents of the slot.
                // uint256(bytes_storage) = uint256(bytes_storage) + uint256(bytes_memory) + new_length
                sstore(
                    _preBytes_slot,
                    // all the modifications to the slot are inside this
                    // next block
                    add(
                        // we can just add to the slot contents because the
                        // bytes we want to change are the LSBs
                        fslot,
                        add(
                            mul(
                                div(
                                    // load the bytes from memory
                                    mload(add(_postBytes, 0x20)),
                                    // zero all bytes to the right
                                    exp(0x100, sub(32, mlength))
                                ),
                                // and now shift left the number of bytes to
                                // leave space for the length in the slot
                                exp(0x100, sub(32, newlength))
                            ),
                            // increase length by the double of the memory
                            // bytes length
                            mul(mlength, 2)
                        )
                    )
                )
            }
            case 1 {
                // The stored value fits in the slot, but the combined value
                // will exceed it.
                // get the keccak hash to get the contents of the array
                mstore(0x0, _preBytes_slot)
                let sc := add(keccak256(0x0, 0x20), div(slength, 32))

                // save new length
                sstore(_preBytes_slot, add(mul(newlength, 2), 1))

                // The contents of the _postBytes array start 32 bytes into
                // the structure. Our first read should obtain the `submod`
                // bytes that can fit into the unused space in the last word
                // of the stored array. To get this, we read 32 bytes starting
                // from `submod`, so the data we read overlaps with the array
                // contents by `submod` bytes. Masking the lowest-order
                // `submod` bytes allows us to add that value directly to the
                // stored value.

                let submod := sub(32, slength)
                let mc := add(_postBytes, submod)
                let end := add(_postBytes, mlength)
                let mask := sub(exp(0x100, submod), 1)

                sstore(
                    sc,
                    add(
                        and(
                            fslot,
                            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00
                        ),
                        and(mload(mc), mask)
                    )
                )

                for {
                    mc := add(mc, 0x20)
                    sc := add(sc, 1)
                } lt(mc, end) {
                    sc := add(sc, 1)
                    mc := add(mc, 0x20)
                } {
                    sstore(sc, mload(mc))
                }

                mask := exp(0x100, sub(mc, end))

                sstore(sc, mul(div(mload(mc), mask), mask))
            }
            default {
                // get the keccak hash to get the contents of the array
                mstore(0x0, _preBytes_slot)
                // Start copying to the last used word of the stored array.
                let sc := add(keccak256(0x0, 0x20), div(slength, 32))

                // save new length
                sstore(_preBytes_slot, add(mul(newlength, 2), 1))

                // Copy over the first `submod` bytes of the new data as in
                // case 1 above.
                let slengthmod := mod(slength, 32)
                let mlengthmod := mod(mlength, 32)
                let submod := sub(32, slengthmod)
                let mc := add(_postBytes, submod)
                let end := add(_postBytes, mlength)
                let mask := sub(exp(0x100, submod), 1)

                sstore(sc, add(sload(sc), and(mload(mc), mask)))
                
                for { 
                    sc := add(sc, 1)
                    mc := add(mc, 0x20)
                } lt(mc, end) {
                    sc := add(sc, 1)
                    mc := add(mc, 0x20)
                } {
                    sstore(sc, mload(mc))
                }

                mask := exp(0x100, sub(mc, end))

                sstore(sc, mul(div(mload(mc), mask), mask))
            }
        }
    }

    function slice(bytes _bytes, uint _start, uint _length) internal  pure returns (bytes) {
        require(_bytes.length >= (_start + _length));

        bytes memory tempBytes;

        assembly {
            switch iszero(_length)
            case 0 {
                // Get a location of some free memory and store it in tempBytes as
                // Solidity does for memory variables.
                tempBytes := mload(0x40)

                // The first word of the slice result is potentially a partial
                // word read from the original array. To read it, we calculate
                // the length of that partial word and start copying that many
                // bytes into the array. The first word we copy will start with
                // data we don't care about, but the last `lengthmod` bytes will
                // land at the beginning of the contents of the new array. When
                // we're done copying, we overwrite the full first word with
                // the actual length of the slice.
                let lengthmod := and(_length, 31)

                // The multiplication in the next line is necessary
                // because when slicing multiples of 32 bytes (lengthmod == 0)
                // the following copy loop was copying the origin's length
                // and then ending prematurely not copying everything it should.
                let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
                let end := add(mc, _length)

                for {
                    // The multiplication in the next line has the same exact purpose
                    // as the one above.
                    let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
                } lt(mc, end) {
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    mstore(mc, mload(cc))
                }

                mstore(tempBytes, _length)

                //update free-memory pointer
                //allocating the array padded to 32 bytes like the compiler does now
                mstore(0x40, and(add(mc, 31), not(31)))
            }
            //if we want a zero-length slice let's just return a zero-length array
            default {
                tempBytes := mload(0x40)

                mstore(0x40, add(tempBytes, 0x20))
            }
        }

        return tempBytes;
    }

    function toAddress(bytes _bytes, uint _start) internal  pure returns (address) {
        require(_bytes.length >= (_start + 20));
        address tempAddress;

        assembly {
            tempAddress := div(mload(add(add(_bytes, 0x20), _start)), 0x1000000000000000000000000)
        }

        return tempAddress;
    }

    function toUint(bytes _bytes, uint _start) internal  pure returns (uint256) {
        require(_bytes.length >= (_start + 32));
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }

        return tempUint;
    }

    function equal(bytes memory _preBytes, bytes memory _postBytes) internal pure returns (bool) {
        bool success = true;

        assembly {
            let length := mload(_preBytes)

            // if lengths don't match the arrays are not equal
            switch eq(length, mload(_postBytes))
            case 1 {
                // cb is a circuit breaker in the for loop since there's
                //  no said feature for inline assembly loops
                // cb = 1 - don't breaker
                // cb = 0 - break
                let cb := 1

                let mc := add(_preBytes, 0x20)
                let end := add(mc, length)

                for {
                    let cc := add(_postBytes, 0x20)
                // the next line is the loop condition:
                // while(uint(mc < end) + cb == 2)
                } eq(add(lt(mc, end), cb), 2) {
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    // if any of these checks fails then arrays are not equal
                    if iszero(eq(mload(mc), mload(cc))) {
                        // unsuccess:
                        success := 0
                        cb := 0
                    }
                }
            }
            default {
                // unsuccess:
                success := 0
            }
        }

        return success;
    }

    function equalStorage(bytes storage _preBytes, bytes memory _postBytes) internal view returns (bool) {
        bool success = true;

        assembly {
            // we know _preBytes_offset is 0
            let fslot := sload(_preBytes_slot)
            // Decode the length of the stored array like in concatStorage().
            let slength := div(and(fslot, sub(mul(0x100, iszero(and(fslot, 1))), 1)), 2)
            let mlength := mload(_postBytes)

            // if lengths don't match the arrays are not equal
            switch eq(slength, mlength)
            case 1 {
                // slength can contain both the length and contents of the array
                // if length < 32 bytes so let's prepare for that
                // v. http://solidity.readthedocs.io/en/latest/miscellaneous.html#layout-of-state-variables-in-storage
                if iszero(iszero(slength)) {
                    switch lt(slength, 32)
                    case 1 {
                        // blank the last byte which is the length
                        fslot := mul(div(fslot, 0x100), 0x100)

                        if iszero(eq(fslot, mload(add(_postBytes, 0x20)))) {
                            // unsuccess:
                            success := 0
                        }
                    }
                    default {
                        // cb is a circuit breaker in the for loop since there's
                        //  no said feature for inline assembly loops
                        // cb = 1 - don't breaker
                        // cb = 0 - break
                        let cb := 1

                        // get the keccak hash to get the contents of the array
                        mstore(0x0, _preBytes_slot)
                        let sc := keccak256(0x0, 0x20)

                        let mc := add(_postBytes, 0x20)
                        let end := add(mc, mlength)

                        // the next line is the loop condition:
                        // while(uint(mc < end) + cb == 2)
                        for {} eq(add(lt(mc, end), cb), 2) {
                            sc := add(sc, 1)
                            mc := add(mc, 0x20)
                        } {
                            if iszero(eq(sload(sc), mload(mc))) {
                                // unsuccess:
                                success := 0
                                cb := 0
                            }
                        }
                    }
                }
            }
            default {
                // unsuccess:
                success := 0
            }
        }

        return success;
    }
}

