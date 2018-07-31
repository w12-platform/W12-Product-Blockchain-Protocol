pragma solidity ^0.4.23;

import "./WToken.sol";

contract WTokenFactoryStub {
    event NewToken(address indexed tokenAddress);

    function createToken(string _name, string _symbol, uint8 _decimals) public returns(WToken token) {
        token = new WToken(_name, _symbol, _decimals);
        token.transferOwnership(msg.sender);

        emit NewToken(token);
    }
}
