pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../crowdsale/IW12Crowdsale.sol";
import "./Percent.sol";
import "./Crowdsale.sol";

library TokenListing {
    using Percent for uint;
    using SafeMath for uint;

    enum CrowdsaleStatus { NotInitialized, Initialized }

    struct WhitelistedToken {
        string name;
        string symbol;
        uint8 decimals;
        address[] owners;
        uint feePercent;
        uint ethFeePercent;
        uint WTokenSaleFeePercent;
        uint trancheFeePercent;
        address crowdsale;
        uint tokensForSaleAmount;
        uint wTokensIssuedAmount;
        address token;
    }

    struct Whitelist {
        // may be used as id
        mapping(address => uint[]) _indexes;
        mapping(address => mapping(uint => bool)) _hasIndex;
        mapping(address => address[]) _owners;
        mapping(address => mapping(address => bool)) _hasOwner;
        WhitelistedToken[] _list;
    }

    function indexes(Whitelist storage whitelist, address token) internal view returns (uint[]) {
        return whitelist._indexes[token];
    }

    function hasIndex(Whitelist storage whitelist, address token, uint index) internal view returns(bool) {
        return whitelist._hasIndex[token][index];
    }

    function isExist(Whitelist storage whitelist, uint index) internal view returns(bool) {
        return whitelist._list[index].token != address(0);
    }

    function owners(Whitelist storage whitelist, address token) internal view returns (address[]) {
        return whitelist._owners[token];
    }

    function hasOwner(Whitelist storage whitelist, address token, address owner) internal view returns (bool) {
        return whitelist._hasOwner[token][owner];
    }

    function getPointerByIndex(Whitelist storage whitelist, uint index)
        internal view returns (WhitelistedToken storage)
    {
        require(isExist(whitelist, index));

        return whitelist._list[index];
    }

    function getCrowdsaleStatus(Whitelist storage whitelist, uint index) internal view returns(CrowdsaleStatus) {
        require(isExist(whitelist, index));

        return getPointerByIndex(whitelist, index).crowdsale == address(0)
            ? CrowdsaleStatus.NotInitialized
            : CrowdsaleStatus.Initialized;
    }

    function add(
        Whitelist storage whitelist,
        address token,
        string name,
        string symbol,
        uint8 decimals,
        address[] tokenOwners,
        uint feePercent,
        uint ethFeePercent,
        uint WTokenSaleFeePercent,
        uint trancheFeePercent
    )
        internal returns(uint)
    {
        require(token != address(0));
        require(owners(whitelist, token).length == 0 && tokenOwners.length > 0);
        require(feePercent.isPercent() && feePercent.fromPercent() < 100);
        require(ethFeePercent.isPercent() && ethFeePercent.fromPercent() < 100);
        require(WTokenSaleFeePercent.isPercent() && WTokenSaleFeePercent.fromPercent() < 100);
        require(trancheFeePercent.isPercent() && trancheFeePercent.fromPercent() < 100);

        uint index = whitelist._list.length;

        whitelist._indexes[token].push(index);
        whitelist._hasIndex[token][index] = true;

        for(uint i = 0; i < tokenOwners.length; i++) {
            require(!hasOwner(whitelist, token, tokenOwners[i]));

            whitelist._owners[token].push(tokenOwners[i]);
            whitelist._hasOwner[token][tokenOwners[i]] = true;
        }

        whitelist._list.push(
            WhitelistedToken({
                name: name,
                symbol: symbol,
                decimals: decimals,
                owners: new address[](0),
                feePercent: feePercent,
                ethFeePercent: ethFeePercent,
                WTokenSaleFeePercent: WTokenSaleFeePercent,
                trancheFeePercent: trancheFeePercent,
                crowdsale: address(0),
                tokensForSaleAmount: 0,
                wTokensIssuedAmount: 0,
                token: token
            })
        );

        return index;
    }
}
