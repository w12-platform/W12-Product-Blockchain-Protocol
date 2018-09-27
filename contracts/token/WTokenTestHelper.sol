pragma solidity ^0.4.24;

import "./WToken.sol";


contract WTokenTestHelper {
    address[] public tokens;
    mapping(address => uint256) public tokenIndexes;

    event NewToken(address indexed tokenAddress);

    function createToken(string _name, string _symbol, uint8 _decimals, uint amountToIssue) public returns(WToken token) {
        token = new WToken(_name, _symbol, _decimals);
        token.transferOwnership(msg.sender);

        tokenIndexes[address(token)] = tokens.length;
        tokens.push(address(token));

        if (amountToIssue > 0) {
            token.mint(msg.sender, amountToIssue * 10 ** uint(_decimals), 0);
        }

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
}
