pragma solidity ^0.4.23;

import "./WToken.sol";

contract WTokenTestHelper {
    address[] public tokens;
    mapping(address => uint256) public tokenIndexes;

    event NewToken(address indexed tokenAddress);

    function createToken(string _name, string _symbol, uint8 _decimals) public returns(WToken token) {
        token = new WToken(_name, _symbol, _decimals);
        token.transferOwnership(msg.sender);

        tokenIndexes[address(token)] = tokens.length;
        tokens.push(address(token));

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

        return WToken(tokenAddress).mint(to, amount, vestingTime);
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
