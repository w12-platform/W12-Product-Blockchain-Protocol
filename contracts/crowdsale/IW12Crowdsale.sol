pragma solidity ^0.4.24;

import "../token/IWToken.sol";
import "./IW12Fund.sol";
import "../access/roles/IAdminRole.sol";
import "../access/roles/IProjectOwnerRole.sol";

contract IW12Crowdsale is IAdminRole, IProjectOwnerRole {
    function setParameters(uint price) external;

    function setup(
        uint[6][] parametersOfStages,
        uint[] bonusConditionsOfStages,
        uint[4][] parametersOfMilestones,
        uint32[] nameAndDescriptionsOffsetOfMilestones,
        bytes nameAndDescriptionsOfMilestones,
        bytes32[] paymentMethodsList
    ) external;

    function getWToken() external view returns(IWToken);

    function getFund() external view returns(IW12Fund);

    function getMilestone(uint index) public view returns (uint32, uint, uint32, uint32, bytes, bytes);

    function getStage(uint index) public view returns (uint32, uint32, uint, uint32, uint[], uint[]);

    function getCurrentMilestoneIndex() public view returns (uint, bool);

    function getLastMilestoneIndex() public view returns (uint index, bool found);

    function milestonesLength() external view returns (uint);

    function getCurrentStageIndex() public view returns (uint index, bool found);

    function getSaleVolumeBonus(uint value) public view returns (uint bonus);

    function isEnded() public view returns (bool);

    function isSaleActive() public view returns (bool);

    function updatePurchaseFeeParameterForPaymentMethod(bytes32 method, bool has, uint value) public;

    function getPurchaseFeeParameterForPaymentMethod(bytes32 method) public view returns (bool, uint);

    function getPurchaseFeeForPaymentMethod(bytes32 method) public view returns (uint);

    function buyTokens(bytes32 method, uint amount) payable public;

    function transferPrimary(address _address) public;
}
