pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./IW12Crowdsale.sol";
import "./IW12Fund.sol";
import "../rates/IRates.sol";
import "../libs/Percent.sol";
import "../libs/FundAccount.sol";
import "../versioning/Versionable.sol";
import "../token/IWToken.sol";

contract W12Fund is Versionable, IW12Fund, Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using Percent for uint;
    using FundAccount for FundAccount.Account;

    bytes32 constant METHOD_ETH = bytes32('ETH');
    bytes32 constant METHOD_USD = bytes32('USD');

    IW12Crowdsale public crowdsale;
    IWToken public wToken;
    IRates public rates;
    address public swap;
    address public serviceWallet;
    // fee for realised tranche
    uint public trancheFeePercent;
    // total percent of realised project tranche
    uint public totalTranchePercentReleased;
    // maps of completed tranches periods
    mapping (uint => bool) public completedTranches;

    // total funded assets
    FundAccount.Account totalFunded;
    // total realised funded assets bt currency symbol
    // updated when tranche was realised or investor assets was refunded
    mapping(bytes32 => uint) totalFundedReleased;
    // total amount of bought token
    uint public totalTokenBought;
    // total amount of refunded token
    uint public totalTokenRefunded;
    // total amount of bought token per investor
    mapping (address => uint) tokenBoughtPerInvestor;
    // total funded assets of each investor
    mapping (address => FundAccount.Account) fundedPerInvestor;

    event FundsReceived(address indexed investor, uint tokenAmount, bytes32 symbol, uint cost);
    event AssetRefunded(address indexed investor, bytes32 symbol, uint amount);
    event TokenRefunded(address indexed investor, uint tokenAmount);
    event TrancheTransferred(address indexed receiver, bytes32 symbol, uint amount);
    event TrancheReleased(address indexed receiver, uint percent);

    constructor(uint version, uint _trancheFeePercent, IRates _rates) Versionable(version) public {
        require(_trancheFeePercent.isPercent() && _trancheFeePercent.fromPercent() < 100);
        require(_rates != address(0));

        trancheFeePercent = _trancheFeePercent;
        rates = _rates;
    }

    function setCrowdsale(IW12Crowdsale _crowdsale) onlyOwner external {
        require(_crowdsale != address(0));
        require(_crowdsale.getWToken() != address(0));

        crowdsale = _crowdsale;
        wToken = IWToken(_crowdsale.getWToken());
    }

    function setSwap(address _swap) onlyOwner external {
        require(_swap != address(0));

        swap = _swap;
    }

    function setServiceWallet(address _serviceWallet) onlyOwner external {
        require(_serviceWallet != address(0));

        serviceWallet = _serviceWallet;
    }

    /**
     * @dev Record purchase result to the fund and check the fund balance
     * @param investor An investor address
     * @param tokenAmount Token amount that was bought
     * @param symbol Symbol of payment method
     * @param cost Cost of token amount
     * @param costUSD Cost in USD
     */
    function recordPurchase(
        address investor,
        uint tokenAmount,
        bytes32 symbol,
        uint cost,
        uint costUSD
    )
        external payable onlyFrom(crowdsale)
    {
        require(tokenAmount > 0);
        require(cost > 0);
        require(costUSD > 0);
        require(investor != address(0));
        require(rates.hasSymbol(symbol));

        // check payment
        if (symbol == METHOD_ETH)  {
            require(msg.value >= cost);
        } else {
            require(rates.isToken(symbol));
            require(ERC20(rates.getTokenAddress(symbol)).balanceOf(address(this)) >= totalFunded.amountOf(symbol).add(cost));
        }

        // write to investor account
        tokenBoughtPerInvestor[investor] = tokenBoughtPerInvestor[investor].add(tokenAmount);
        fundedPerInvestor[investor].deposit(symbol, cost);
        fundedPerInvestor[investor].deposit(METHOD_USD, costUSD);

        // write to total fund
        totalTokenBought = totalTokenBought.add(tokenAmount);
        totalFunded.deposit(symbol, cost);
        totalFunded.deposit(METHOD_USD, costUSD);

        emit FundsReceived(investor, tokenAmount, symbol, cost);
    }

    function getInvestorFundedAmount(address _investor, bytes32 _symbol) public view returns(uint) {
        return fundedPerInvestor[_investor].amountOf(_symbol);
    }

    function getInvestorFundedAssetsSymbols(address _investor) public view returns(bytes32[]) {
        return fundedPerInvestor[_investor].symbolsList();
    }

    function getInvestorTokenBoughtAmount(address _investor) public view returns (uint) {
        return tokenBoughtPerInvestor[_investor];
    }

    function getTotalFundedAmount(bytes32 _symbol) public view returns (uint) {
        return totalFunded.amountOf(_symbol);
    }

    function getTotalFundedAssetsSymbols() public view returns (bytes32[]) {
        return totalFunded.symbolsList();
    }

    function getTotalFundedReleased(bytes32 _symbol) public view returns (uint) {
        return totalFundedReleased[_symbol];
    }

    /**
     * @notice Get tranche invoice
     * @return uint[3] result:
     * [tranchePercent, totalTranchePercentBefore, milestoneIndex]
     */
    function getTrancheInvoice() public view returns (uint[3] result) {
        if (!trancheTransferAllowed()) return;

        (uint index, /*bool found*/) = crowdsale.getCurrentMilestoneIndex();
        (uint lastIndex, /*bool found*/) = crowdsale.getLastMilestoneIndex();

        (,,, uint32 lastWithdrawalWindow,,) = crowdsale.getMilestone(lastIndex);

        // get percent from prev milestone
        index = index == 0 || lastIndex == index ? index : index - 1;

        ( , uint tranchePercent, , uint32 withdrawalWindow, , ) = crowdsale.getMilestone(index);

        bool completed = completedTranches[index];

        if (completed) return;

        uint prevIndex = index;
        uint totalTranchePercentBefore;

        while (prevIndex > 0) {
            prevIndex--;

            (, uint _tranchePercent, , , , ) = crowdsale.getMilestone(prevIndex);

            totalTranchePercentBefore = totalTranchePercentBefore.add(_tranchePercent);
        }

        result[0] = tranchePercent
            .add(totalTranchePercentBefore)
            .sub(totalTranchePercentReleased);
        result[1] = totalTranchePercentBefore;
        result[2] = index;
    }

    /**
     * @notice Realise project tranche
     */
    function tranche() external onlyOwner nonReentrant {
        require(trancheTransferAllowed());

        uint[3] memory trancheInvoice = getTrancheInvoice();

        require(trancheInvoice[0] > 0);
        require(totalFunded.symbolsList().length != 0);

        completedTranches[trancheInvoice[2]] = true;
        totalTranchePercentReleased = totalTranchePercentReleased.add(trancheInvoice[0]);

        _transferTranche(trancheInvoice);

        emit TrancheReleased(msg.sender, trancheInvoice[0]);
    }

    function _transferTranche(uint[3] _invoice) internal {
        uint ln = totalFunded.symbolsList().length;

        while(ln != 0) {
            bytes32 symbol = totalFunded.symbolsList()[--ln];
            uint amount = totalFunded.amountOf(symbol);

            if (amount == 0) continue;

            uint sourceAmount = amount.safePercent(_invoice[0]);

            require(sourceAmount > 0);
            
            amount = Utils.safeMulDiv(
                totalTokenBought.sub(totalTokenRefunded),
                sourceAmount,
                totalTokenBought
            );

            require(amount > 0);

            totalFundedReleased[symbol] = totalFundedReleased[symbol].add(amount);
            
            if (symbol == METHOD_USD)  continue;

            if (symbol != METHOD_ETH) {
                require(rates.isToken(symbol));
                require(ERC20(rates.getTokenAddress(symbol)).balanceOf(address(this)) >= amount);
            }

            uint fee = trancheFeePercent > 0
                ? amount.safePercent(trancheFeePercent)
                : 0;

            if (trancheFeePercent > 0) require(fee > 0);

            if (symbol == METHOD_ETH) {
                if (fee > 0) serviceWallet.transfer(fee);
                msg.sender.transfer(amount.sub(fee));
            } else {
                if (fee > 0) require(ERC20(rates.getTokenAddress(symbol)).transfer(serviceWallet, fee));
                require(ERC20(rates.getTokenAddress(symbol)).transfer(msg.sender, amount.sub(fee)));
            }

            emit TrancheTransferred(msg.sender, symbol, amount);
        }
    }

    /**
     * @notice Refund bought tokens
     */
    function refund(uint tokenAmount) external nonReentrant {
        require(tokenRefundAllowed());
        require(tokenAmount != 0);
        require(tokenBoughtPerInvestor[msg.sender] >= tokenAmount);
        require(wToken.balanceOf(msg.sender) >= tokenAmount);
        require(wToken.allowance(msg.sender, address(this)) >= tokenAmount);

        _refundAssets(tokenAmount);

        totalTokenRefunded = totalTokenRefunded.add(tokenAmount);
        tokenBoughtPerInvestor[msg.sender] = tokenBoughtPerInvestor[msg.sender].sub(tokenAmount);

        require(wToken.transferFrom(msg.sender, swap, tokenAmount));

        emit TokenRefunded(msg.sender, tokenAmount);
    }

    function _refundAssets(uint tokenAmount) internal {
        uint ln = fundedPerInvestor[msg.sender].symbolsList().length;

        while (ln != 0) {
            bytes32 symbol = fundedPerInvestor[msg.sender].symbolsList()[--ln];
            uint amount = fundedPerInvestor[msg.sender].amountOf(symbol);

            if (amount == 0) continue;

            // get source amount
            uint sourceAmount = Utils.safeMulDiv(
                tokenAmount,
                amount,
                tokenBoughtPerInvestor[msg.sender]
            );

            require(sourceAmount > 0);

            // get released tranche amount in current currency
            uint releasedTranche = totalFunded
                .amountOf(symbol)
                .safePercent(totalTranchePercentReleased);

            // get amount minus released tranche
            amount = Utils.safeMulDiv(
                totalFunded.amountOf(symbol).sub(releasedTranche),
                sourceAmount,
                totalFunded.amountOf(symbol)
            );

            require(amount > 0);

            totalFundedReleased[symbol] = totalFundedReleased[symbol].add(amount);
            fundedPerInvestor[msg.sender].withdrawal(symbol, sourceAmount);

            if (symbol == METHOD_USD) continue;

            if (symbol != METHOD_ETH) {
                require(rates.isToken(symbol));
                require(ERC20(rates.getTokenAddress(symbol)).balanceOf(address(this)) >= amount);
            } else {
                require(address(this).balance >= amount);
            }

            if (symbol == METHOD_ETH) {
                msg.sender.transfer(amount);
            } else {
                require(ERC20(rates.getTokenAddress(symbol)).transfer(msg.sender, amount));
            }

            emit AssetRefunded(msg.sender, symbol, amount);
        }
    }

    function tokenRefundAllowed() public view returns (bool) {
        (uint index, bool found) = crowdsale.getCurrentMilestoneIndex();

        // first milestone is reserved for the project to claim initial amount of payments. No refund allowed at this stage.
        if(index == 0) return;

        (uint32 endDate, , , uint32 withdrawalWindow, , ) = crowdsale.getMilestone(index);

        return endDate <= now && now < withdrawalWindow;
    }

    function trancheTransferAllowed() public view returns (bool) {
        (uint index, bool found) = crowdsale.getCurrentMilestoneIndex();

        if(!found) return;

        return index == 0 || isWithdrawalWindowActive();
    }

    function isWithdrawalWindowActive() public view returns (bool) {
        (uint index, bool found) = crowdsale.getCurrentMilestoneIndex();

        if(index == 0 || !found) return;

        (uint32 endDate, , ,uint32 lastWithdrawalWindow, , ) = crowdsale.getMilestone(index);

        return endDate > now || now >= lastWithdrawalWindow;
    }

    modifier onlyFrom(address sender) {
        require(msg.sender == sender);

        _;
    }
}
