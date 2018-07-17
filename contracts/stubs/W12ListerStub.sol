pragma solidity ^0.4.23;

import "../W12Lister.sol";

contract W12ListerStub is W12Lister {

  /**
   * @dev Allows for any account besides the owner.
   */
  modifier onlyOwner() {
    _;
  }

}
