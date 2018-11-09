pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./IW12Crowdsale.sol";
import "./IW12Fund.sol";
import "../rates/IRates.sol";
import "../libs/Utils.sol";
import "../libs/Percent.sol";
import "../libs/FundAccount.sol";
import "../libs/Fund.sol";
import "../versioning/Versionable.sol";
import "../token/IWToken.sol";
import "../access/roles/AdminRole.sol";
import "../access/roles/ProjectOwnerRole.sol";

contract W12Fund is IW12Fund, AdminRole, ProjectOwnerRole, Versionable, Secondary, ReentrancyGuard {
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

    Fund.State state;

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

    function addAdmin(address _account) public onlyAdmin {
        _addAdmin(_account);
    }

    function removeAdmin(address _account) public onlyAdmin {
        _removeAdmin(_account);
    }

    function addProjectOwner(address _account) public onlyAdmin {
        _addProjectOwner(_account);
    }

    function removeProjectOwner(address _account) public onlyAdmin {
        _removeProjectOwner(_account);
    }

    function setCrowdsale(IW12Crowdsale _crowdsale) onlyAdmin external {
        require(_crowdsale != address(0));
        require(_crowdsale.getWToken() != address(0));

        crowdsale = _crowdsale;
        wToken = IWToken(_crowdsale.getWToken());
    }

    function setSwap(address _swap) onlyAdmin external {
        require(_swap != address(0));

        swap = _swap;
    }

    function setServiceWallet(address _serviceWallet) onlyAdmin external {
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
        external payable onlyCrowdsale
    {
        Fund.recordPurchase(
            state,
            investor,
            tokenAmount,
            symbol,
            cost,
            costUSD,
            rates
        );
    }

    // total percent of realised project tranche
    function totalTranchePercentReleased() public view returns (uint) {
        return state.totalTranchePercentReleased;
    }

    function completedTranches(uint milestoneIndex) public view returns (bool) {
        return state.completedTranches[milestoneIndex];
    }

    // total amount of bought token
    function totalTokenBought() public view returns (uint) {
        return state.totalTokenBought;
    }

    // total amount of refunded token
    function totalTokenRefunded() public view returns (uint) {
        return state.totalTokenRefunded;
    }

    function getInvestorFundedAmount(address _investor, bytes32 _symbol) public view returns(uint) {
        return state.fundedPerInvestor[_investor].amountOf(_symbol);
    }

    function getInvestorFundedAssetsSymbols(address _investor) public view returns(bytes32[]) {
        return state.fundedPerInvestor[_investor].symbolsList();
    }

    function getInvestorTokenBoughtAmount(address _investor) public view returns (uint) {
        return state.tokenBoughtPerInvestor[_investor];
    }

    function getTotalFundedAmount(bytes32 _symbol) public view returns (uint) {
        return state.totalFunded.amountOf(_symbol);
    }

    function getTotalFundedAssetsSymbols() public view returns (bytes32[]) {
        return state.totalFunded.symbolsList();
    }

    function getTotalFundedReleased(bytes32 _symbol) public view returns (uint) {
        return state.totalFundedReleased[_symbol];
    }

    /**
     * @notice Get tranche invoice
     * @return uint[3] result:
     * [tranchePercent, totalTranchePercentBefore, milestoneIndex]
     */
    function getTrancheInvoice() public view returns (uint[3] result) {
        return Fund.getTrancheInvoice(
            state,
            trancheTransferAllowed(),
            crowdsale
        );
    }

    /**
     * @notice Realise project tranche
     */
    function tranche() external onlyProjectOwner nonReentrant {
        require(trancheTransferAllowed());

        uint[3] memory trancheInvoice = getTrancheInvoice();

        require(trancheInvoice[0] > 0);
        require(state.totalFunded.symbolsList().length != 0);

        state.completedTranches[trancheInvoice[2]] = true;
        state.totalTranchePercentReleased = state.totalTranchePercentReleased.add(trancheInvoice[0]);

        _transferTranche(trancheInvoice);

        emit TrancheReleased(msg.sender, trancheInvoice[0]);
    }

    function _transferTranche(uint[3] _invoice) internal {
        Fund.transferTranche(
            state,
            _invoice,
            trancheFeePercent,
            serviceWallet,
            rates
        );
    }

    /**
     * @notice Refund bought tokens
     */
    function refund(uint tokenAmount) external nonReentrant {
        require(tokenRefundAllowed());
        require(tokenAmount != 0);
        require(state.tokenBoughtPerInvestor[msg.sender] >= tokenAmount);
        require(wToken.balanceOf(msg.sender) >= tokenAmount);
        require(wToken.allowance(msg.sender, address(this)) >= tokenAmount);

        _refundAssets(tokenAmount);

        state.totalTokenRefunded = state.totalTokenRefunded.add(tokenAmount);
        state.tokenBoughtPerInvestor[msg.sender] = state.tokenBoughtPerInvestor[msg.sender].sub(tokenAmount);

        require(wToken.transferFrom(msg.sender, swap, tokenAmount));

        emit TokenRefunded(msg.sender, tokenAmount);
    }

    function _refundAssets(uint tokenAmount) internal {
        Fund.refundAssets(
            state,
            tokenAmount,
            rates
        );
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

    modifier onlyCrowdsale {
        require(msg.sender == address(crowdsale));

        _;
    }
}
