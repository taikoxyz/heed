// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Heed} from "impl/Heed.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract Deployers {
    function _deployHeed(uint32 cap, address owner) internal returns (Heed) {
        Heed impl = new Heed(cap);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeCall(Heed.initialize, (owner)));
        return Heed(address(proxy));
    }
}
