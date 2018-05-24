pragma solidity ^0.4.23;

import "../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "./W12TokenLedger.sol";


contract W12AtomicSwap is Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for ERC20;

    W12TokenLedger public ledger;

    constructor (W12TokenLedger _ledger) public {
        require(_ledger != address(0x0));

        ledger = _ledger;
    }

    function exchange(ERC20 fromToken, uint amount) external nonReentrant {
        require(fromToken != address(0x0));
        require(toToken != address(0x0));
        // Checking if fromToken is WToken and have actual pair
        ERC20 toToken = ledger.getTokenByWToken(fromToken);
        require(toToken != address(0x0));
        // we won't check `amount` for zero because ERC20 implies zero amount transfers as a valid case

        address swapAddress = address(this);
        uint senderFromTokenBalanceBefore = fromToken.balanceOf(msg.sender);
        uint senderToTokenBalanceBefore = toToken.balanceOf(msg.sender);

        uint swapFromTokenBalanceBefore = fromToken.balanceOf(swapAddress);
        uint swapToTokenBalanceBefore = toToken.balanceOf(swapAddress);

        fromToken.safeTransferFrom(msg.sender, address(this), amount);
        toToken.safeTransfer(msg.sender, amount);

        uint senderFromTokenBalanceAfter = fromToken.balanceOf(msg.sender);
        uint senderToTokenBalanceAfter = toToken.balanceOf(msg.sender);

        uint swapFromTokenBalanceAfter = fromToken.balanceOf(swapAddress);
        uint swapToTokenBalanceAfter = toToken.balanceOf(swapAddress);

        require(senderFromTokenBalanceBefore.sub(amount) == senderFromTokenBalanceAfter);
        require(senderToTokenBalanceBefore.add(amount) == senderToTokenBalanceAfter);

        require(swapToTokenBalanceBefore.sub(amount) == swapToTokenBalanceAfter);
        require(swapFromTokenBalanceBefore.add(amount) == swapFromTokenBalanceAfter);
    }
}
