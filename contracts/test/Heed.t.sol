// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {Heed} from "impl/Heed.sol";
import {IHeed} from "iface/IHeed.sol";
import {Reverter} from "./utils/Reverter.sol";

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

    function test_trust_addsAndEmits() public {
        address bob = makeAddr("bob");
        address carol = makeAddr("carol");
        address[] memory list = new address[](2);
        list[0] = bob;
        list[1] = carol;
        vm.expectEmit(true, true, false, true, address(tm));
        emit IHeed.Trusted(alice, bob, true);
        vm.expectEmit(true, true, false, true, address(tm));
        emit IHeed.Trusted(alice, carol, true);
        vm.prank(alice);
        tm.trust(list);
        assertTrue(tm.trusts(alice, bob));
        assertTrue(tm.trusts(alice, carol));
    }

    function test_untrust_removesAndEmits() public {
        address bob = makeAddr("bob");
        address[] memory list = new address[](1);
        list[0] = bob;
        vm.startPrank(alice);
        tm.trust(list);
        vm.expectEmit(true, true, false, true, address(tm));
        emit IHeed.Trusted(alice, bob, false);
        tm.untrust(list);
        vm.stopPrank();
        assertFalse(tm.trusts(alice, bob));
    }

    function test_registerDelegate_setsMappingsAndForwardsValue() public {
        address delegate = makeAddr("delegate");
        bytes32 clientId = keccak256("heed-mac-v1");
        vm.deal(alice, 1 ether);

        vm.expectEmit(true, true, false, true, address(tm));
        emit IHeed.DelegateRegistered(alice, delegate, clientId);
        vm.prank(alice);
        tm.registerDelegate{value: 0.01 ether}(delegate, clientId);

        assertEq(tm.delegateOwner(delegate), alice);
        assertEq(tm.delegateClient(delegate), clientId);
        assertEq(delegate.balance, 0.01 ether);
    }

    function test_revokeDelegate_byOwner() public {
        address delegate = makeAddr("delegate");
        vm.startPrank(alice);
        tm.registerDelegate(delegate, bytes32(0));
        vm.expectEmit(true, true, false, true, address(tm));
        emit IHeed.DelegateRevoked(alice, delegate);
        tm.revokeDelegate(delegate);
        vm.stopPrank();
        assertEq(tm.delegateOwner(delegate), address(0));
    }

    function test_revokeMyself_byDelegate() public {
        address delegate = makeAddr("delegate");
        vm.prank(alice);
        tm.registerDelegate(delegate, bytes32(0));
        vm.prank(delegate);
        tm.revokeMyself();
        assertEq(tm.delegateOwner(delegate), address(0));
    }

    function test_sendBatch_atomic_singleSuccess() public {
        address bob = makeAddr("bob");
        vm.prank(bob);
        tm.setFee(100);

        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](1);
        mails[0] = IHeed.MailIntent({
            recipient: bob,
            valueGwei: 100,
            contentRef: bytes32(uint256(0xabcd))
        });

        vm.deal(alice, 1 ether);
        uint256 bobBefore = bob.balance;
        uint256 aliceBefore = alice.balance;

        vm.expectEmit(true, true, false, true, address(tm));
        emit IHeed.MailSent(alice, bob, bytes32(uint256(0xabcd)), 100);
        vm.prank(alice);
        tm.sendBatch{value: 100 gwei}(mails, true);

        assertEq(bob.balance - bobBefore, 100 gwei);
        assertEq(aliceBefore - alice.balance, 100 gwei);
    }

    function test_sendBatch_atomic_revertsOnInsufficientValue() public {
        address bob = makeAddr("bob");
        vm.prank(bob); tm.setFee(100);

        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](1);
        mails[0] = IHeed.MailIntent({recipient: bob, valueGwei: 50, contentRef: bytes32(0)});

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert();
        tm.sendBatch{value: 50 gwei}(mails, true);
    }

    function test_sendBatch_bestEffort_skipsAndRefunds() public {
        address bob = makeAddr("bob");
        address carol = makeAddr("carol");
        Reverter reverter = new Reverter();
        vm.prank(bob);   tm.setFee(100);
        vm.prank(carol); tm.setFee(50);

        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](3);
        mails[0] = IHeed.MailIntent({recipient: bob, valueGwei: 100, contentRef: bytes32(uint256(1))});
        mails[1] = IHeed.MailIntent({recipient: address(reverter), valueGwei: 0, contentRef: bytes32(uint256(2))});
        mails[2] = IHeed.MailIntent({recipient: carol, valueGwei: 50, contentRef: bytes32(uint256(3))});

        vm.deal(alice, 1 ether);
        uint256 totalAttached = 200 gwei;
        vm.prank(alice);
        tm.sendBatch{value: totalAttached}(mails, false);

        assertEq(bob.balance, 100 gwei);
        assertEq(carol.balance, 50 gwei);
        assertEq(alice.balance, 1 ether - 150 gwei);
    }

    function test_sendBatch_atomic_revertsOnReverter() public {
        Reverter reverter = new Reverter();
        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](1);
        mails[0] = IHeed.MailIntent({recipient: address(reverter), valueGwei: 100, contentRef: bytes32(0)});
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IHeed.MailFailed.selector, 0));
        tm.sendBatch{value: 100 gwei}(mails, true);
    }

    function test_sendBatch_delegateAttribution() public {
        address bob = makeAddr("bob");
        address delegate = makeAddr("delegate");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        tm.registerDelegate{value: 0.05 ether}(delegate, bytes32(0));

        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](1);
        mails[0] = IHeed.MailIntent({recipient: bob, valueGwei: 0, contentRef: bytes32(uint256(1))});

        vm.expectEmit(true, true, false, true, address(tm));
        emit IHeed.MailSent(alice, bob, bytes32(uint256(1)), 0); // sender == owner, not delegate
        vm.prank(delegate);
        tm.sendBatch{value: 0}(mails, true);
    }

    function test_getInbox_returnsFeeAndKeys() public {
        bytes32 pub0 = bytes32(uint256(0x42));
        vm.startPrank(alice);
        tm.publishKey(0, pub0);
        tm.setFee(7);
        vm.stopPrank();

        IHeed.InboxView memory v = tm.getInbox(alice);
        assertEq(v.feeGwei, 7);
        assertEq(v.keys[0].pub, pub0);
    }

    function test_getInboxes_batched() public {
        address bob = makeAddr("bob");
        address[] memory list = new address[](2);
        list[0] = alice; list[1] = bob;
        IHeed.InboxView[] memory vs = tm.getInboxes(list);
        assertEq(vs.length, 2);
    }
}
