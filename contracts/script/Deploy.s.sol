// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script} from "forge-std/Script.sol";
import {Heed} from "impl/Heed.sol";

contract Deploy is Script {
    function run() external returns (Heed heed) {
        vm.startBroadcast();
        heed = new Heed(10_000_000); // 0.01 ETH cap
        vm.stopBroadcast();
    }
}
