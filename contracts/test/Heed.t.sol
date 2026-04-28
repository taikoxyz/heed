// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {Heed} from "impl/Heed.sol";
import {IHeed} from "iface/IHeed.sol";

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

    function test_publishKey_rejectsZeroPub() public {
        vm.prank(alice);
        vm.expectRevert(IHeed.EmptyPubKey.selector);
        tm.publishKey(0, bytes32(0));
    }

    function test_publishKey_firstNonceZeroThenOne_keepsBoth() public {
        bytes32 pubA = bytes32(uint256(0xAA));
        bytes32 pubB = bytes32(uint256(0xBB));
        vm.startPrank(alice);
        tm.publishKey(0, pubA);
        tm.publishKey(1, pubB);
        vm.stopPrank();

        IHeed.EncKey[2] memory keys = tm.getKeys(alice);
        // Both pubs must survive — the slot order is unspecified, so check by content.
        bool foundA = keys[0].pub == pubA || keys[1].pub == pubA;
        bool foundB = keys[0].pub == pubB || keys[1].pub == pubB;
        assertTrue(foundA, "pubA missing - slot rotation lost it");
        assertTrue(foundB, "pubB missing");
    }

    function test_publishKey_thirdPublishEvictsOldestFromTwoPopulatedSlots() public {
        bytes32 pubA = bytes32(uint256(0xAA));
        bytes32 pubB = bytes32(uint256(0xBB));
        bytes32 pubC = bytes32(uint256(0xCC));
        vm.startPrank(alice);
        tm.publishKey(1, pubA);
        tm.publishKey(2, pubB);
        tm.publishKey(3, pubC);
        vm.stopPrank();

        IHeed.EncKey[2] memory keys = tm.getKeys(alice);
        bool foundA = keys[0].pub == pubA || keys[1].pub == pubA;
        bool foundB = keys[0].pub == pubB || keys[1].pub == pubB;
        bool foundC = keys[0].pub == pubC || keys[1].pub == pubC;
        assertFalse(foundA, "pubA should have been evicted (oldest of three)");
        assertTrue(foundB, "pubB missing");
        assertTrue(foundC, "pubC missing");
    }

    function test_setFee_storesAndEmits() public {
        vm.expectEmit(true, false, false, true, address(tm));
        emit IHeed.FeeUpdated(alice, 12345);
        vm.prank(alice);
        tm.setFee(12345);
        assertEq(tm.feeGwei(alice), 12345);
    }

    function test_setFee_revertsAboveCap() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IHeed.FeeAboveCap.selector, 10_000_001, 10_000_000));
        tm.setFee(10_000_001);
    }

    function test_setFee_zeroIsAllowed() public {
        vm.prank(alice);
        tm.setFee(0);
        assertEq(tm.feeGwei(alice), 0);
    }
}
