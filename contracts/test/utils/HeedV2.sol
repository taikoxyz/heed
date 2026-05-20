// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Heed} from "impl/Heed.sol";

contract HeedV2 is Heed {
    constructor(uint32 cap) Heed(cap) {}

    function version() external pure returns (uint256) {
        return 2;
    }
}
