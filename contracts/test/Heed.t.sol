// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {Heed} from "src/Heed.sol";
import {IHeed} from "src/interfaces/IHeed.sol";

contract HeedTest is Test {
    Heed tm;
    address alice = makeAddr("alice");

    function setUp() public {
        tm = new Heed(10_000_000);
    }

    function test_publishKey_storesAndEmits() public {
        bytes32 pub0 = bytes32(uint256(1));
        vm.expectEmit(true, false, false, true, address(tm));
        emit IHeed.KeyPublished(alice, 0, pub0);
        vm.prank(alice);
        tm.publishKey(0, pub0);

        IHeed.EncKey[2] memory keys = tm.getKeys(alice);
        assertEq(keys[0].keyNonce, 0);
        assertEq(keys[0].pub, pub0);
        assertEq(keys[1].pub, bytes32(0));
    }

    function test_publishKey_rotatesOldestSlot() public {
        vm.startPrank(alice);
        tm.publishKey(0, bytes32(uint256(1)));
        tm.publishKey(1, bytes32(uint256(2)));
        tm.publishKey(2, bytes32(uint256(3)));
        vm.stopPrank();

        IHeed.EncKey[2] memory keys = tm.getKeys(alice);
        uint32 minNonce = keys[0].keyNonce < keys[1].keyNonce ? keys[0].keyNonce : keys[1].keyNonce;
        uint32 maxNonce = keys[0].keyNonce > keys[1].keyNonce ? keys[0].keyNonce : keys[1].keyNonce;
        assertEq(minNonce, 1);
        assertEq(maxNonce, 2);
    }

    function test_publishKey_rejectsNonMonotonic() public {
        vm.startPrank(alice);
        tm.publishKey(5, bytes32(uint256(1)));
        vm.expectRevert(abi.encodeWithSelector(IHeed.KeyNonceNotMonotonic.selector, 3, 5));
        tm.publishKey(3, bytes32(uint256(2)));
        vm.stopPrank();
    }
}
