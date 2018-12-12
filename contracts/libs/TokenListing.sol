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
        address token;
        bytes32[] paymentMethods;
        uint[] paymentMethodsPurchaseFee;
        mapping(address => bool) _hasOwner;
    }

    struct Crowdsale {
        address crowdsale;
        uint feePercent;
        uint ethFeePercent;
        uint WTokenSaleFeePercent;
        uint trancheFeePercent;
        uint tokensForSaleAmount;
        uint wTokensIssuedAmount;
        address[] owners;
        bytes32[] paymentMethods;
        uint[] paymentMethodsPurchaseFee;
    }

    struct Whitelist {
        // may be used as id
        // token address -> index
        mapping(address => uint) _index;
        // token address -> index -> bool
        mapping(address => mapping(uint => bool)) _hasIndex;
        // token address -> crowdsale
        // []
        // [initialised, initialised, non-initialised]
        // [initialised, initialised, initialised]
        mapping(address => Crowdsale[]) _crowdsales;
        // token address -> crowdsale address -> bool
        mapping(address => mapping(address => bool)) _hasCrowdsaleIndex;
        // token address -> crowdsale address -> index
        mapping(address => mapping(address => uint)) _crowdsaleIndex;

        WhitelistedToken[] _list;
    }

    event OwnerWhitelisted(address indexed tokenAddress, address indexed tokenOwner);

    function getTokens(Whitelist storage whitelist) internal view returns (WhitelistedToken[]) {
        return whitelist._list;
    }

    function isTokenWhitelisted(Whitelist storage whitelist, address token) internal view returns (bool) {
        return whitelist._hasIndex[token][whitelist._index[token]];
    }

    function tokenIndex(Whitelist storage whitelist, address token) internal view returns (uint) {
        require(isTokenWhitelisted(whitelist, token));

        return whitelist._index[token];
    }

    function hasTokenOwner(Whitelist storage whitelist, address token, address owner) internal view returns (bool) {
        return getToken(whitelist, token)._hasOwner[owner];
    }

    function getCrowdsales(Whitelist storage whitelist, address token) internal view returns (Crowdsale[]) {
        require(isTokenWhitelisted(whitelist, token));

        return whitelist._crowdsales[token];
    }

    function hasCrowdsaleWithAddress(Whitelist storage whitelist, address token, address crowdsale) internal view returns (bool) {
        require(isTokenWhitelisted(whitelist, token));

        return whitelist._hasCrowdsaleIndex[token][crowdsale];
    }

    function hasNotInitialisedCrowdsale(Whitelist storage whitelist, address token) internal view returns (bool) {
        require(isTokenWhitelisted(whitelist, token));

        return whitelist._hasCrowdsaleIndex[token][address(0)];
    }

    function getNotInitialisedCrowdsale(Whitelist storage whitelist, address token)
        internal view returns (Crowdsale storage)
    {
        return getCrowdsaleByAddress(whitelist, token, address(0));
    }

    function getCrowdsaleByAddress(Whitelist storage whitelist, address token, address crowdsale)
        internal view returns (Crowdsale storage)
    {
        require(hasCrowdsaleWithAddress(whitelist, token, crowdsale));

        return whitelist._crowdsales[token][whitelist._crowdsaleIndex[token][crowdsale]];
    }

    function getCrowdsaleIndexByAddress(Whitelist storage whitelist, address token, address crowdsale)
        internal view returns (uint)
    {
        require(hasCrowdsaleWithAddress(whitelist, token, crowdsale));

        return whitelist._crowdsaleIndex[token][crowdsale];
    }

    function getToken(Whitelist storage whitelist, address token)
        internal view returns (WhitelistedToken storage)
    {
        return whitelist._list[tokenIndex(whitelist, token)];
    }

    function _removeOwners(WhitelistedToken storage record) private {
        if (record.owners.length > 0) {
            for (uint i = 0; i < record.owners.length; i++) {
                record._hasOwner[record.owners[i]] = false;
            }
            record.owners.length = 0;
        }
    }

    function _addNotInitializedCrowdsale(Whitelist storage whitelist, address token) private {
        require(!hasNotInitialisedCrowdsale(whitelist, token));

        uint crowdsaleIndex = whitelist._crowdsales[token].length;
        whitelist._hasCrowdsaleIndex[token][address(0)] = true;
        whitelist._crowdsaleIndex[token][address(0)] = crowdsaleIndex;
        whitelist._crowdsales[token].push(
            Crowdsale({
                crowdsale : address(0),
                feePercent : 0,
                ethFeePercent : 0,
                WTokenSaleFeePercent : 0,
                trancheFeePercent : 0,
                tokensForSaleAmount : 0,
                wTokensIssuedAmount : 0,
                owners : new address[](0),
                paymentMethods: new bytes32[](0),
                paymentMethodsPurchaseFee: new uint[](0)
            })
        );
    }

    function _addTokenOwner(Whitelist storage whitelist, address token, address owner) private {
        require(owner != address(0));
        // check for duplicates
        require(!hasTokenOwner(whitelist, token, owner));

        getToken(whitelist, token).owners.push(owner);
        getToken(whitelist, token)._hasOwner[owner] = true;

        emit OwnerWhitelisted(token, owner);
    }

    function _validatePaymentMethodsParameters(
        bytes32[] paymentMethods,
        uint[] paymentMethodsPurchaseFee
    )
        private pure returns(bool)
    {
        if(paymentMethods.length == paymentMethodsPurchaseFee.length) {
            for(uint i = 0; i < paymentMethods.length; i++) {
                if (!paymentMethodsPurchaseFee[i].isPercent() || paymentMethodsPurchaseFee[i] > Percent.MAX()) {
                    return false;
                }
                // this better way then having mapping in some case
                for(uint ii = i + 1; ii < paymentMethods.length; ii++) {
                    if (paymentMethods[i] == paymentMethods[ii]) {
                        return false;
                    }
                }
            }
            return true;
        }
        return false;
    }

    function addOrUpdate(
        Whitelist storage whitelist,
        address token,
        string name,
        string symbol,
        uint8 decimals,
        address[] tokenOwners,
        uint[4] commissions, // [feePercent, ethFeePercent, WTokenSaleFeePercent, trancheFeePercent]
        bytes32[] paymentMethods,
        uint[] paymentMethodsPurchaseFee
    )
        internal returns(uint)
    {
        require(token != address(0));
        require(tokenOwners.length > 0);
        require(commissions[0].isPercent() && commissions[0].fromPercent() < 100);
        require(commissions[1].isPercent() && commissions[1].fromPercent() < 100);
        require(commissions[2].isPercent() && commissions[2].fromPercent() < 100);
        require(commissions[3].isPercent() && commissions[3].fromPercent() < 100);
        require(_validatePaymentMethodsParameters(paymentMethods, paymentMethodsPurchaseFee));

        if (!isTokenWhitelisted(whitelist, token)) {
            whitelist._index[token] = whitelist._list.length;
            whitelist._hasIndex[token][whitelist._list.length] = true;
            whitelist._list.push(
                WhitelistedToken({
                    name: name,
                    symbol: symbol,
                    decimals: decimals,
                    owners: new address[](0),
                    feePercent: commissions[0],
                    ethFeePercent: commissions[1],
                    WTokenSaleFeePercent: commissions[2],
                    trancheFeePercent: commissions[3],
                    token: token,
                    paymentMethods: paymentMethods,
                    paymentMethodsPurchaseFee: paymentMethodsPurchaseFee
                })
            );
        } else {
            _removeOwners(getToken(whitelist, token));
            getToken(whitelist, token).name = name;
            getToken(whitelist, token).symbol = symbol;
            getToken(whitelist, token).decimals = decimals;
            getToken(whitelist, token).feePercent = commissions[0];
            getToken(whitelist, token).ethFeePercent = commissions[1];
            getToken(whitelist, token).WTokenSaleFeePercent = commissions[2];
            getToken(whitelist, token).trancheFeePercent = commissions[3];
            getToken(whitelist, token).paymentMethods = paymentMethods;
            getToken(whitelist, token).paymentMethodsPurchaseFee = paymentMethodsPurchaseFee;
        }

        for (uint i = 0; i < tokenOwners.length; i++) {
            _addTokenOwner(whitelist, token, tokenOwners[i]);
        }

        if (!hasNotInitialisedCrowdsale(whitelist, token)) {
            _addNotInitializedCrowdsale(whitelist, token);
        }

        return whitelist._index[token];
    }


    function initializeCrowdsale(Whitelist storage whitelist, address token, address crowdsale) internal {
        require(crowdsale != address(0));
        require(hasNotInitialisedCrowdsale(whitelist, token));
        require(!hasCrowdsaleWithAddress(whitelist, token, crowdsale));

        getNotInitialisedCrowdsale(whitelist, token).crowdsale = crowdsale;
        getNotInitialisedCrowdsale(whitelist, token).feePercent = getToken(whitelist, token).feePercent;
        getNotInitialisedCrowdsale(whitelist, token).ethFeePercent = getToken(whitelist, token).ethFeePercent;
        getNotInitialisedCrowdsale(whitelist, token).WTokenSaleFeePercent = getToken(whitelist, token).WTokenSaleFeePercent;
        getNotInitialisedCrowdsale(whitelist, token).trancheFeePercent = getToken(whitelist, token).trancheFeePercent;
        getNotInitialisedCrowdsale(whitelist, token).owners = getToken(whitelist, token).owners;
        getNotInitialisedCrowdsale(whitelist, token).paymentMethods = getToken(whitelist, token).paymentMethods;
        getNotInitialisedCrowdsale(whitelist, token).paymentMethodsPurchaseFee = getToken(whitelist, token).paymentMethodsPurchaseFee;

        whitelist._hasCrowdsaleIndex[token][crowdsale] = true;
        whitelist._crowdsaleIndex[token][crowdsale] = getCrowdsaleIndexByAddress(whitelist, token, address(0));
        whitelist._hasCrowdsaleIndex[token][address(0)] = false;
        whitelist._crowdsaleIndex[token][address(0)] = 0;
    }
}
