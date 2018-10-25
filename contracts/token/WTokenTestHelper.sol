pragma solidity ^0.4.24;

import "./WToken.sol";


contract WTokenTestHelper {
    address[] public tokens;
    mapping(address => uint256) public tokenIndexes;

    event NewToken(address indexed tokenAddress);

    function createToken(string _name, string _symbol, uint8 _decimals, uint amountToIssue) public returns(WToken token) {
        require(_isStringValid(_name, 5, 50));
        require(_isStringValid(_symbol, 3, 5));
        require(_decimals > uint8(1) && _decimals < uint8(19));
        require(amountToIssue > 99 && amountToIssue <= (uint(-1) / 10 ** uint(_decimals)));

        token = new WToken(_name, _symbol, _decimals);
        token.transferOwnership(msg.sender);

        tokenIndexes[address(token)] = tokens.length;
        tokens.push(address(token));

        token.mint(msg.sender, amountToIssue * 10 ** uint(_decimals), 0);

        emit NewToken(token);
    }

    function tokensList() public view returns(address[]) {
        return tokens;
    }

    function hasToken(address tokenAddress) public view returns (bool) {
        return tokens.length > 0 && tokens[tokenIndexes[tokenAddress]] == tokenAddress;
    }

    function mint(address tokenAddress, address to, uint amount, uint32 vestingTime) public returns (bool) {
        require(hasToken(tokenAddress));

        WToken token = WToken(tokenAddress);

        return token.mint(to, amount * 10 ** uint(token.decimals()), vestingTime);
    }

    function balanceOf(address tokenAddress, address wallet) public view returns (uint) {
        require(hasToken(tokenAddress));

        return WToken(tokenAddress).balanceOf(wallet);
    }

    function totalSupply(address tokenAddress) public view returns (uint) {
        require(hasToken(tokenAddress));

        return WToken(tokenAddress).totalSupply();
    }

    function _isStringValid(string _string, uint minLn, uint maxLn) internal pure returns(bool) {
        require(maxLn >= minLn);

        bytes memory _stringBytes = bytes(_string);

        // allow empty
        if (_stringBytes.length == 0 && minLn == 0) return true;
        // not match length
        if (_stringBytes.length < minLn || _stringBytes.length > maxLn) return;
        // spaces at beginning and ending
        if (_stringBytes[0] == 0x20 || _stringBytes[_stringBytes.length - 1] == 0x20) return;

        for(uint i = 0; i < _stringBytes.length; i++) {
            if (
                !(_stringBytes[i] == 0x20 && _stringBytes[i + 1] != 0x20)  // space, not followed by space
                && !(_stringBytes[i] >= 0x30 && _stringBytes[i] <= 0x39) // 0-9
                && !(_stringBytes[i] >= 0x41 && _stringBytes[i] <= 0x5a) // A-Z
                && !(_stringBytes[i] >= 0x61 && _stringBytes[i] <= 0x7a) // a-z
            ) return false;
        }

        return true;
    }
}
