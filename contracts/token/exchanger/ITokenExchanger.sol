pragma solidity ^0.4.24;

import "./ITokenExchange.sol";
import "./ITokenLedger.sol";

contract ITokenExchanger is ITokenExchange, ITokenLedger {}
