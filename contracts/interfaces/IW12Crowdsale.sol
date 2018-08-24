pragma solidity ^0.4.24;

import "../WToken.sol";


interface IW12Crowdsale {
    function setParameters(uint _price, address _serviceWallet) external;

    function setStages(uint32[2][] dates, uint8[] stage_discounts, uint32[] stage_vestings) external;

    function setStageVolumeBonuses(uint stage, uint[] volumeBoundaries, uint8[] volumeBonuses) external;

    function getWToken() external view returns(WToken);

    function getCurrentMilestone() external view returns (uint32, uint8, uint32, uint32, bytes, bytes);

    function getMilestone(uint index) public view returns (uint32, uint8, uint32, uint32, bytes, bytes);

    function getCurrentMilestoneIndex() public view returns (uint);

    function milestonesLength() external view returns (uint);

    function getCurrentStageIndex() public view returns (uint index, bool found);

    function getSaleVolumeBonus(uint value) public view returns (uint bonus);

    function isEnded() public view returns (bool);

    function isSaleActive() public view returns (bool);

    function () payable external;

    function buyTokens() payable external;

    function transferOwnership(address newOwner) public;
}
