pragma solidity ^0.4.24;

import "../token/IWToken.sol";


interface IW12Crowdsale {
    function setParameters(uint price) external;

    // TODO: this should be external
    // See https://github.com/ethereum/solidity/issues/4832
    function setup(
        uint[6][] parametersOfStages,
        uint[] bonusConditionsOfStages,
        uint[4][] parametersOfMilestones,
        uint32[] nameAndDescriptionsOffsetOfMilestones,
        bytes nameAndDescriptionsOfMilestones,
        bytes32[] paymentMethodsList
    ) external;

    function getWToken() external view returns(IWToken);

    function getMilestone(uint index) external view returns (uint32, uint, uint32, uint32, bytes, bytes);

    function getStage(uint index) external view returns (uint32, uint32, uint, uint32, uint[], uint[]);

    function getCurrentMilestoneIndex() external view returns (uint, bool);

    function getLastMilestoneIndex() external view returns (uint index, bool found);

    function milestonesLength() external view returns (uint);

    function getCurrentStageIndex() external view returns (uint index, bool found);

    function getSaleVolumeBonus(uint value) external view returns (uint bonus);

    function isEnded() external view returns (bool);

    function isSaleActive() external view returns (bool);

    function buyTokens(bytes32 method, uint amount) payable external;

    function transferOwnership(address newOwner) external;
}
