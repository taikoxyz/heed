// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test, Vm} from "forge-std/Test.sol";
import {Heed} from "impl/Heed.sol";
import {IHeed} from "iface/IHeed.sol";

contract Handler is Test {
    Heed public tm;
    constructor(Heed _tm) { tm = _tm; }

    function send(uint8 nMails, uint96 totalValue, bool atomic, address[3] memory rcpts) external {
        vm.assume(rcpts[0] != address(0) && rcpts[1] != address(0) && rcpts[2] != address(0));
        nMails = uint8(bound(nMails, 1, 3));
        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](nMails);
        for (uint256 i; i < nMails; ++i) {
            mails[i] = IHeed.MailIntent({
                recipient: rcpts[i],
                valueGwei: uint32(uint256(keccak256(abi.encode(i))) % 200),
                contentRef: bytes32(uint256(i))
            });
        }
        try tm.sendBatch{value: totalValue}(mails, atomic) {} catch {}
    }
}

contract HeedInvariantTest is Test {
    Heed tm;
    Handler handler;

    function setUp() public {
        tm = new Heed(10_000_000);
        handler = new Handler(tm);
        vm.deal(address(handler), type(uint128).max);
        targetContract(address(handler));
    }

    function invariant_contractHoldsNoEth() public view {
        assertEq(address(tm).balance, 0);
    }
}

contract HeedAccountingFuzzTest is Test {
    Heed tm;
    address sender = makeAddr("sender");
    address[3] rcpts;
    bytes32[3] contentRefs;

    function setUp() public {
        tm = new Heed(10_000_000);
        rcpts[0] = makeAddr("r0");
        rcpts[1] = makeAddr("r1");
        rcpts[2] = makeAddr("r2");
        contentRefs[0] = bytes32(uint256(0xa));
        contentRefs[1] = bytes32(uint256(0xb));
        contentRefs[2] = bytes32(uint256(0xc));
    }

    function testFuzz_accountingInvariant_bestEffort(
        uint96 attached,
        uint32 v0,
        uint32 v1,
        uint32 v2,
        uint32 fee0,
        uint32 fee1,
        uint32 fee2
    ) public {
        fee0 = uint32(bound(fee0, 0, 10_000_000));
        fee1 = uint32(bound(fee1, 0, 10_000_000));
        fee2 = uint32(bound(fee2, 0, 10_000_000));
        v0 = uint32(bound(v0, 0, 10_000_000));
        v1 = uint32(bound(v1, 0, 10_000_000));
        v2 = uint32(bound(v2, 0, 10_000_000));

        vm.prank(rcpts[0]); tm.setFee(fee0);
        vm.prank(rcpts[1]); tm.setFee(fee1);
        vm.prank(rcpts[2]); tm.setFee(fee2);

        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](3);
        mails[0] = IHeed.MailIntent({recipient: rcpts[0], valueGwei: v0, contentRef: contentRefs[0]});
        mails[1] = IHeed.MailIntent({recipient: rcpts[1], valueGwei: v1, contentRef: contentRefs[1]});
        mails[2] = IHeed.MailIntent({recipient: rcpts[2], valueGwei: v2, contentRef: contentRefs[2]});

        vm.deal(sender, type(uint128).max);
        uint256 senderBefore = sender.balance;

        vm.recordLogs();
        vm.prank(sender);
        tm.sendBatch{value: attached}(mails, false);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        uint256 totalEmittedWei;
        bytes32 mailSentTopic = keccak256("MailSent(address,address,bytes32,uint32)");
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == mailSentTopic) {
                (, uint32 emittedValueGwei) = abi.decode(logs[i].data, (bytes32, uint32));
                totalEmittedWei += uint256(emittedValueGwei) * 1 gwei;
            }
        }

        uint256 netSpent = senderBefore - sender.balance;
        assertEq(netSpent, totalEmittedWei, "accounting invariant violated");
        assertEq(address(tm).balance, 0, "contract leaked ETH");
    }

    function testFuzz_accountingInvariant_atomic(
        uint96 attached,
        uint32 v0,
        uint32 v1,
        uint32 fee0,
        uint32 fee1
    ) public {
        fee0 = uint32(bound(fee0, 0, 10_000_000));
        fee1 = uint32(bound(fee1, 0, 10_000_000));
        v0 = uint32(bound(v0, 0, 10_000_000));
        v1 = uint32(bound(v1, 0, 10_000_000));

        vm.prank(rcpts[0]); tm.setFee(fee0);
        vm.prank(rcpts[1]); tm.setFee(fee1);

        IHeed.MailIntent[] memory mails = new IHeed.MailIntent[](2);
        mails[0] = IHeed.MailIntent({recipient: rcpts[0], valueGwei: v0, contentRef: contentRefs[0]});
        mails[1] = IHeed.MailIntent({recipient: rcpts[1], valueGwei: v1, contentRef: contentRefs[1]});

        vm.deal(sender, type(uint128).max);
        uint256 senderBefore = sender.balance;

        vm.recordLogs();
        vm.prank(sender);
        try tm.sendBatch{value: attached}(mails, true) {
            Vm.Log[] memory logs = vm.getRecordedLogs();
            uint256 totalEmittedWei;
            bytes32 mailSentTopic = keccak256("MailSent(address,address,bytes32,uint32)");
            for (uint256 i = 0; i < logs.length; ++i) {
                if (logs[i].topics.length > 0 && logs[i].topics[0] == mailSentTopic) {
                    (, uint32 emittedValueGwei) = abi.decode(logs[i].data, (bytes32, uint32));
                    totalEmittedWei += uint256(emittedValueGwei) * 1 gwei;
                }
            }
            uint256 netSpent = senderBefore - sender.balance;
            assertEq(netSpent, totalEmittedWei, "atomic accounting invariant violated");
        } catch {
            assertEq(sender.balance, senderBefore, "balance mutated despite revert");
        }
        assertEq(address(tm).balance, 0, "contract leaked ETH");
    }
}
