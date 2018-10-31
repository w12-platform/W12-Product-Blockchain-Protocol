pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "./Percent.sol";

library Crowdsale {
    using SafeMath for uint;
    using Percent for uint;
    using BytesLib for bytes;

    struct Stage {
        uint32 startDate;
        uint32 endDate;
        uint discount;
        uint32 vesting;
        uint[] volumeBoundaries;
        uint[] volumeBonuses;
    }

    struct Milestone {
        uint32 endDate;
        uint tranchePercent;
        uint32 voteEndDate;
        uint32 withdrawalWindow;
        bytes name;
        bytes description;
    }

    /**
     * @dev Update stages
     * @param parameters List of primary parameters:
     * [
     *   uint32 startDate,
     *   uint32 endDate,
     *   uint discount,
     *   uint32 vesting,
     *   uint8 startIndexOfBonusConditions
     *   uint8 endIndexOfBonusConditions
     * ],
     * @param bonusConditions List of bonus conditions:
     * [uint boundary, uint bonus, ...]
     */
    function setStages(
        Stage[] storage stages,
        Milestone[] storage milestones,
        uint[6][] parameters,
        uint[] bonusConditions
    ) public {
        if (milestones.length > 0) {
            // end date of firs milestone must be greater then end date of last stage
            require(milestones[0].endDate > parameters[parameters.length - 1][1]);
        }

        stages.length = 0;

        for (uint8 i = 0; i < parameters.length; i++) {
            // check overflow
            require(parameters[i][0] <= uint32(- 1));
            require(parameters[i][1] <= uint32(- 1));
            require(parameters[i][3] <= uint32(- 1));
            require(parameters[i][4] <= uint8(- 1));
            require(parameters[i][5] <= uint8(- 1));

            // check dates
            require(parameters[i][0] > now);
            require(parameters[i][0] < parameters[i][1]);

            if (i > 0) {
                require(parameters[i - 1][1] <= parameters[i][0]);
            }

            // check discount
            require(parameters[i][2].isPercent());
            require(parameters[i][2] < Percent.MAX());

            stages.push(Stage({
                startDate: uint32(parameters[i][0]),
                endDate: uint32(parameters[i][1]),
                discount: parameters[i][2],
                vesting: uint32(parameters[i][3]),
                volumeBoundaries: new uint[](0),
                volumeBonuses: new uint[](0)
            }));

            setStageBonusConditions(
                stages,
                uint8(stages.length - 1),
                uint8(parameters[i][4]),
                uint8(parameters[i][5]),
                bonusConditions
            );
        }
    }

    /**
     * @dev Set stage bonus conditions by stage index
     * @param bonusConditions List of bonus conditions:
     * [uint boundary, uint bonus, ...]
     */
    function setStageBonusConditions(
        Stage[] storage stages,
        uint8 stageIndex,
        uint8 start,
        uint8 end,
        uint[] bonusConditions
    ) public {
        if (start == 0 && end == 0) {
            stages[stageIndex].volumeBoundaries = new uint[](0);
            stages[stageIndex].volumeBonuses = new uint[](0);

            return;
        }

        require(end <= bonusConditions.length);
        require(start < end);
        require(start % 2 == 0);
        require(end % 2 == 0);

        uint[] memory boundaries = new uint[]((end - start) / 2);
        uint[] memory bonuses = new uint[]((end - start) / 2);
        uint k = 0;

        while (start < end) {
            // check bonus
            require(bonusConditions[start + 1].isPercent());
            require(bonusConditions[start + 1] < Percent.MAX());

            // check boundary
            if (k > 0) {
                require(boundaries[k - 1] < bonusConditions[start]);
            }

            boundaries[k] = bonusConditions[start];
            bonuses[k] = bonusConditions[start + 1];
            k++;
            start += 2;
        }

        stages[stageIndex].volumeBoundaries = boundaries;
        stages[stageIndex].volumeBonuses = bonuses;
    }

    /**
     * @dev Update milestones
     * @param parameters List of primary parameters:
     * [
     *   uint32 endDate,
     *   uint32 voteEndDate,
     *   uint32 withdrawalWindow,
     *   uint tranchPercent
     * ]
     * @param offsets Offsets of names and descriptions in namesAndDescriptions:
     * [uint32 offset1, uint32 offset2, ...]
     * @param namesAndDescriptions Names and descriptions
     */
    function setMilestones(
        Stage[] storage stages,
        Milestone[] storage milestones,
        uint[4][] parameters,
        uint32[] offsets,
        bytes namesAndDescriptions
    ) public {
        if (stages.length > 0) {
            require(stages[stages.length - 1].endDate < parameters[0][0]);
        }

        milestones.length = 0;

        uint offset = 0;
        uint k = 0;
        uint totalPercents = 0;

        for (uint8 i = 0; i < parameters.length; i++) {
            // check overflow
            require(parameters[i][0] <= uint32(- 1));
            require(parameters[i][1] <= uint32(- 1));
            require(parameters[i][2] <= uint32(- 1));

            // check dates
            require(parameters[i][0] > now);
            require(parameters[i][1] > parameters[i][0]);
            require(parameters[i][2] > parameters[i][1]);

            if (i > 0) {
                require(parameters[i - 1][2] < parameters[i][0]);
            }

            // check tranch percent
            require(parameters[i][3].isPercent());

            bytes memory name = namesAndDescriptions.slice(offset, offsets[k]);
            offset = offset.add(offsets[k]);
            bytes memory description = namesAndDescriptions.slice(offset, offsets[k + 1]);
            offset = offset.add(offsets[k + 1]);
            k = k.add(2);

            totalPercents = totalPercents.add(parameters[i][3]);

            milestones.push(Milestone({
                endDate : uint32(parameters[i][0]),
                tranchePercent : parameters[i][3],
                voteEndDate : uint32(parameters[i][1]),
                withdrawalWindow : uint32(parameters[i][2]),
                name : name,
                description : description
            }));
        }

        require(totalPercents == Percent.MAX());
    }
}
