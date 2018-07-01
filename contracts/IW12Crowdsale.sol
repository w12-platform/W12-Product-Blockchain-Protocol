pragma solidity ^0.4.24;

interface IW12Crowdsale {
    function setParameters(uint32 _startDate, uint _price, address _serviceWallet) external;

    function setStages(uint32[] stage_endDates, uint8[] stage_discounts, uint32[] stage_vestings) external;

    function () payable external;
}

interface IW12CrowdsaleFactory {
    function createCrowdsale(address _wTokenAddress, uint32 _startDate, uint price, address serviceWallet, uint8 serviceFee, address fund, address owner) external returns (IW12Crowdsale);
}
