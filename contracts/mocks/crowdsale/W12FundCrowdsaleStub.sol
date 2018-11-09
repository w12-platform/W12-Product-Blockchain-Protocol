pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../crowdsale/IW12Crowdsale.sol";
import "../../crowdsale/IW12Fund.sol";
import "../../token/IWToken.sol";
import "../../libs/Percent.sol";
import "../../versioning/Versionable.sol";

contract W12FundCrowdsaleStub is Versionable, IW12Crowdsale, Secondary, ReentrancyGuard {
    uint _currentMilestoneIndex;
    bool _currentMilestoneIndexFound;
    uint _lastMilestoneIndex;
    bool _lastMilestoneIndexFound;
    mapping (uint => Milestone) _currentMilestones;
    IWToken _wtoken;

    struct Milestone {
        uint32 endDate;
        uint tranchePercent;
        uint32 voteEndDate;
        uint32 withdrawalWindow;
        bytes name;
        bytes description;
    }

    constructor(uint version) Versionable(version) public {}

    function setParameters(uint price) external {}

    function setup(
        uint[6][] parametersOfStages,
        uint[] bonusConditionsOfStages,
        uint[4][] parametersOfMilestones,
        uint32[] nameAndDescriptionsOffsetOfMilestones,
        bytes nameAndDescriptionsOfMilestones,
        bytes32[] paymentMethodsList
    ) external {}

    function getWToken() external view returns (IWToken) {
        return _wtoken;
    }

    function _getWTokenMockData(IWToken a) external {
        _wtoken = a;
    }

    function getMilestone(uint index) public view returns (uint32, uint, uint32, uint32, bytes, bytes) {
        return (
            _currentMilestones[index].endDate,
            _currentMilestones[index].tranchePercent,
            _currentMilestones[index].voteEndDate,
            _currentMilestones[index].withdrawalWindow,
            _currentMilestones[index].name,
            _currentMilestones[index].description
        );
    }

    function _getMilestoneMockData(uint idx, uint32 a, uint b, uint32 c, uint32 d, bytes e, bytes f) external {
        _currentMilestones[idx] = Milestone({
            endDate: a,
            tranchePercent: b,
            voteEndDate: c,
            withdrawalWindow: d,
            name: e,
            description: f
        });
    }

    function getStage(uint index) public view returns (uint32, uint32, uint, uint32, uint[], uint[]) {}

    function getCurrentMilestoneIndex() public view returns (uint, bool) {
        return (_currentMilestoneIndex, _currentMilestoneIndexFound);
    }

    function _getCurrentMilestoneIndexMockData(uint a, bool b) public {
        _currentMilestoneIndex = a;
        _currentMilestoneIndexFound = b;
    }

    function getLastMilestoneIndex() public view returns (uint index, bool found) {
        return (_lastMilestoneIndex, _lastMilestoneIndexFound);
    }

    function _getLastMilestoneIndexMockData(uint a, bool b) public {
        _lastMilestoneIndex = a;
        _lastMilestoneIndexFound = b;
    }

    function milestonesLength() external view returns (uint) {}

    function getCurrentStageIndex() public view returns (uint index, bool found) {}

    function getSaleVolumeBonus(uint value) public view returns (uint bonus) {}

    function isEnded() public view returns (bool) {}

    function isSaleActive() public view returns (bool) {}

    function() payable external {}

    function buyTokens(bytes32 method, uint amount) payable public {}
}
