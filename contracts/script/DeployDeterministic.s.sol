// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script} from "forge-std/Script.sol";
import {Heed} from "impl/Heed.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Deploys Heed (impl + UUPS proxy) at a deterministic CREATE2 address. With a fixed SALT and
// identical initcode (owner is part of the proxy's init calldata), the resulting address is the
// same on every chain, independent of the deploying EOA. OWNER and SALT come from env.
contract DeployDeterministic is Script {
    function run() external returns (address impl, address proxy) {
        address owner = vm.envAddress("OWNER");
        bytes32 salt = vm.envBytes32("SALT");
        vm.startBroadcast();
        Heed implC = new Heed{salt: salt}(10_000_000); // 0.01 ETH per-mail fee cap
        ERC1967Proxy proxyC =
            new ERC1967Proxy{salt: salt}(address(implC), abi.encodeCall(Heed.initialize, (owner)));
        vm.stopBroadcast();
        impl = address(implC);
        proxy = address(proxyC);
    }
}
