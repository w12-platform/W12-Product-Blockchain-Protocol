pragma solidity ^0.4.24;

import "../../crowdsale/IW12Crowdsale.sol";

contract W12Lister__W12CrowdsaleMock is IW12Crowdsale {

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

    function setParameters(uint price) external {}

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
