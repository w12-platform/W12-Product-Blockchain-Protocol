pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "../IWToken.sol";


contract ITokenLedger {
    function addTokenToListing(ERC20Detailed token, IWToken wToken) external;

    function hasPair(ERC20Detailed token1, ERC20Detailed token2) public view returns (bool);

    function getWTokenByToken(address token) public view returns (IWToken);

    function getTokenByWToken(address wToken) public view returns (ERC20Detailed);
}
