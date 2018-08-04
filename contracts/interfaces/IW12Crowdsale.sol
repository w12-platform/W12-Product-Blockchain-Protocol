pragma solidity ^0.4.24;

import "../WToken.sol";


interface IW12Crowdsale {
    function setParameters(uint32 _startDate, uint _price, address _serviceWallet) external;

    function setStages(uint32[] stage_endDates, uint8[] stage_discounts, uint32[] stage_vestings) external;

    function setStageVolumeBonuses(uint stage, uint[] volumeBoundaries, uint8[] volumeBonuses) external;

    function getWToken() external view returns(WToken);

    function getCurrentMilestone() external view returns (uint32, uint8, uint32, uint32, bytes, bytes);

    function getCurrentMilestoneIndex() public view returns (uint);

    function getMilestone(uint index) public view returns (uint32, uint8, uint32, uint32, bytes, bytes);

    function isEnded() public view returns (bool);

    function () payable external;

    function buyTokens() payable external;

    function transferOwnership(address newOwner) public;
}
