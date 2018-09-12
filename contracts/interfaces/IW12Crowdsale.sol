pragma solidity ^0.4.24;

import "../WToken.sol";


interface IW12Crowdsale {
    function setParameters(uint price) external;

    function setStages(uint32[2][] dates, uint[] stage_discounts, uint32[] stage_vestings) external;

    function setStageVolumeBonuses(uint stage, uint[] volumeBoundaries, uint[] volumeBonuses) external;

    function getWToken() external view returns(WToken);

    function getMilestone(uint index) external view returns (uint32, uint, uint32, uint32, bytes, bytes);

    function getStage(uint index) external view returns (uint32, uint32, uint, uint32, uint[], uint[]);

    function getCurrentMilestoneIndex() external view returns (uint, bool);

    function getLastMilestoneIndex() external view returns (uint index, bool found);

    function milestonesLength() external view returns (uint);

    function getCurrentStageIndex() external view returns (uint index, bool found);

    function getSaleVolumeBonus(uint value) external view returns (uint bonus);

    function isEnded() external view returns (bool);

    function isSaleActive() external view returns (bool);

    function () payable external;

    function buyTokens() payable external;

    function transferOwnership(address newOwner) external;
}
