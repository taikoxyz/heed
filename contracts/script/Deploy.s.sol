// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script} from "forge-std/Script.sol";
import {Heed} from "impl/Heed.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy is Script {
    function run() external returns (Heed heed) {
        vm.startBroadcast();
        Heed impl = new Heed(10_000_000); // 0.01 ETH cap
        bytes memory data = abi.encodeCall(Heed.initialize, (msg.sender));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        heed = Heed(address(proxy));
        vm.stopBroadcast();
    }
}
