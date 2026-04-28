// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;
contract Reverter { receive() external payable { revert("nope"); } }
