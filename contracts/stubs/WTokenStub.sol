pragma solidity ^0.4.23;

import "../WToken.sol";

contract WTokenStub is WToken {

  /**
   * @dev Allows for any account besides the owner.
   */
  modifier onlyOwner() {
    _;
  }

}
