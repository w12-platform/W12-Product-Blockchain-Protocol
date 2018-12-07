pragma solidity ^0.4.24;

import "../../crowdsale/IW12Crowdsale.sol";
import "../../crowdsale/IW12Fund.sol";
import "./W12Lister__W12FundMock.sol";

contract W12Lister__W12CrowdsaleMock is IW12Crowdsale {
    IW12Fund private _fund;

    constructor() public {
        _fund = new W12Lister__W12FundMock();
    }

    function isAdmin(address account) public view returns (bool) {}

    address public _addAdminCall;

    function addAdmin(address account) public {
        _addAdminCall = account;
    }

    function renounceAdmin() public {}

    function removeAdmin(address account) public {}

    function isProjectOwner(address account) public view returns (bool) {}

    function addProjectOwner(address account) public {}

    function renounceProjectOwner() public {}

    function removeProjectOwner(address account) public {}

    function getFund() external view returns (IW12Fund) {
        return _fund;
    }

    function setParameters(uint price) external {}

    struct UpdatePurchaseFeeParameterForPaymentMethodCall {
        bytes32 method;
        bool has;
        uint value;
    }

    UpdatePurchaseFeeParameterForPaymentMethodCall[] public __updatePurchaseFeeParameterForPaymentMethodCalls;

    function _updatePurchaseFeeParameterForPaymentMethodCallsLength() public view returns(uint) {
        return __updatePurchaseFeeParameterForPaymentMethodCalls.length;
    }

    function _updatePurchaseFeeParameterForPaymentMethodCall(uint index) public view returns (bytes32, bool, uint) {
        return (
            __updatePurchaseFeeParameterForPaymentMethodCalls[index].method,
            __updatePurchaseFeeParameterForPaymentMethodCalls[index].has,
            __updatePurchaseFeeParameterForPaymentMethodCalls[index].value
        );
    }

    function updatePurchaseFeeParameterForPaymentMethod(bytes32 method, bool has, uint value) public {
        __updatePurchaseFeeParameterForPaymentMethodCalls.push(
            UpdatePurchaseFeeParameterForPaymentMethodCall(method, has, value)
        );
    }

    function getPurchaseFeeParameterForPaymentMethod(bytes32 method) public view returns (bool, uint) {}

    function getPurchaseFeeForPaymentMethod(bytes32 method) public view returns (uint) {}

    function transferPrimary(address _address) public {}

    function setup(
        uint[6][] parametersOfStages,
        uint[] bonusConditionsOfStages,
        uint[4][] parametersOfMilestones,
        uint32[] nameAndDescriptionsOffsetOfMilestones,
        bytes nameAndDescriptionsOfMilestones,
        bytes32[] paymentMethodsList
    ) external {}

    function getWToken() external view returns (IWToken) {}

    function getMilestone(uint index) public view returns (uint32, uint, uint32, uint32, bytes, bytes) {}

    function getStage(uint index) public view returns (uint32, uint32, uint, uint32, uint[], uint[]) {}

    function getCurrentMilestoneIndex() public view returns (uint, bool) {}

    function getLastMilestoneIndex() public view returns (uint index, bool found) {}

    function milestonesLength() external view returns (uint) {}

    function getCurrentStageIndex() public view returns (uint index, bool found) {}

    function getSaleVolumeBonus(uint value) public view returns (uint bonus) {}

    function isEnded() public view returns (bool) {}

    function isSaleActive() public view returns (bool) {}

    function() payable external {}

    function buyTokens(bytes32 method, uint amount) payable public {}
}
