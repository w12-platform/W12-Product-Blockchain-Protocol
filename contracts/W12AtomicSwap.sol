pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "./W12TokenLedger.sol";
import "./versioning/Versionable.sol";


contract W12AtomicSwap is Versionable, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for ERC20;

    W12TokenLedger public ledger;

    event Exchange(address indexed from, address indexed to, uint amount, address indexed sender);

    constructor (uint version, W12TokenLedger _ledger) Versionable(version) public {
        require(_ledger != address(0));

        ledger = _ledger;
    }

    function approve(ERC20 token, address spender, uint amount) external onlyOwner returns (bool) {
        return token.approve(spender, amount);
    }

    function exchange(ERC20 fromToken, uint amount) external nonReentrant {
        require(fromToken != address(0));
        // Checking if fromToken is WToken and have actual pair
        ERC20 toToken = ledger.getTokenByWToken(fromToken);
        require(toToken != address(0));
        // we won't check `amount` for zero because ERC20 implies zero amount transfers as a valid case

        fromToken.safeTransferFrom(msg.sender, address(this), amount);
        toToken.safeTransfer(msg.sender, amount);

        emit Exchange(address(fromToken), address(toToken), amount, msg.sender);
    }
}
