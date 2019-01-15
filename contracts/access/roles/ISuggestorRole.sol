pragma solidity 0.4.24;


contract ISuggestorRole {
    function isSuggestor(address account) public view returns (bool);

    function addSuggestor(address account) public;

    function renounceSuggestor() public;

    function removeSuggestor(address account) public;
}
