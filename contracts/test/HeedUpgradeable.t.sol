// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {Heed} from "impl/Heed.sol";
import {IHeed} from "iface/IHeed.sol";
import {Deployers} from "./utils/Deployers.sol";
import {HeedV2} from "./utils/HeedV2.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract HeedUpgradeableTest is Test, Deployers {
    Heed tm;
    address owner = makeAddr("owner");
    address stranger = makeAddr("stranger");
    address newOwner = makeAddr("newOwner");

    function setUp() public {
        tm = _deployHeed(10_000_000, owner);
    }

    function test_initialize_setsOwner() public view {
        assertEq(tm.owner(), owner);
        assertEq(tm.pendingOwner(), address(0));
        assertEq(tm.MAX_FEE_GWEI(), 10_000_000);
    }

    function test_initialize_revertsOnSecondCall() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        tm.initialize(stranger);
    }

    function test_initialize_revertsOnRawImplementation() public {
        Heed impl = new Heed(10_000_000);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        impl.initialize(stranger);
    }

    function test_transferOwnership_isTwoStep() public {
        vm.prank(owner);
        tm.transferOwnership(newOwner);
        // Ownership has not moved yet; only pendingOwner is set.
        assertEq(tm.owner(), owner);
        assertEq(tm.pendingOwner(), newOwner);

        vm.prank(newOwner);
        tm.acceptOwnership();
        assertEq(tm.owner(), newOwner);
        assertEq(tm.pendingOwner(), address(0));
    }

    function test_acceptOwnership_revertsForNonPending() public {
        vm.prank(owner);
        tm.transferOwnership(newOwner);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, stranger)
        );
        tm.acceptOwnership();
    }

    function test_transferOwnership_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, stranger)
        );
        tm.transferOwnership(newOwner);
    }

    function test_upgrade_revertsForNonOwner() public {
        HeedV2 v2 = new HeedV2(10_000_000);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, stranger)
        );
        tm.upgradeToAndCall(address(v2), "");
    }

    function test_upgrade_byOwnerSucceeds() public {
        HeedV2 v2 = new HeedV2(10_000_000);
        vm.prank(owner);
        tm.upgradeToAndCall(address(v2), "");
        assertEq(HeedV2(address(tm)).version(), 2);
    }

    function test_renounceOwnership_freezesUpgrades() public {
        vm.prank(owner);
        tm.renounceOwnership();
        assertEq(tm.owner(), address(0));

        // With no owner, upgrades are permanently disabled (the contract is frozen).
        HeedV2 v2 = new HeedV2(10_000_000);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, owner)
        );
        tm.upgradeToAndCall(address(v2), "");

        // Permissionless user functions still work after freezing.
        address alice = makeAddr("alice");
        vm.prank(alice);
        tm.setFee(123);
        assertEq(tm.feeGwei(alice), 123);
    }

    function test_upgrade_preservesState() public {
        address alice = makeAddr("alice");
        bytes32 pub = bytes32(uint256(0xCAFE));
        vm.startPrank(alice);
        tm.setFee(4242);
        tm.publishKey(7, pub);
        vm.stopPrank();

        HeedV2 v2 = new HeedV2(10_000_000);
        vm.prank(owner);
        tm.upgradeToAndCall(address(v2), "");

        assertEq(tm.feeGwei(alice), 4242);
        IHeed.EncKey[2] memory keys = tm.getKeys(alice);
        bool found = keys[0].pub == pub || keys[1].pub == pub;
        assertTrue(found, "published key lost across upgrade");
        assertEq(tm.owner(), owner, "owner lost across upgrade");
    }
}
