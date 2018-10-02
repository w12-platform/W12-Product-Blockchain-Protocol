pragma solidity ^0.4.24;

// https://semver.org. Version represent as decimal number, 4 decimals per part, max 9999 9999 9999
// 1.1.1 => 100010001
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract VersionsLedger is Ownable {
    // all versions in net
    uint[] public versions;

    // used only one main address to map version
    mapping(uint => address) public addressByVersion;
    mapping(address => uint) public versionByAddress;

    function setVersion(address _address, uint version) public onlyOwner {
        require(addressByVersion[version] == address(0));

        (uint lastV, ) = getLastVersion();

        require(lastV < version);

        versions.push(version);
        addressByVersion[version] = _address;
        versionByAddress[_address] = version;
    }

    function getVersions() public view returns (uint[]) {
        return versions;
    }

    function getAddresses() public view returns (address[]) {
        if (versions.length == 0) return;

        address[] memory result = new address[](versions.length);

        for (uint i = 0; i < versions.length; i++) {
            result[i] = addressByVersion[versions[i]];
        }

        return result;
    }

    function getLastVersion() public view returns (uint version, bool found) {
        if (versions.length == 0) return;

        found = true;
        version = versions[versions.length - 1];
    }
}
