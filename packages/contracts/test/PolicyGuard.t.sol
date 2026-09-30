// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentPolicyGuardModule} from "../src/PolicyGuardModule.sol";

contract PolicyGuardTest is Test {
    AgentPolicyGuardModule g;
    address owner = address(0x0111);
    address acct = address(0xACC7);
    address target = address(0x7A26);
    address stranger = address(0x5555);

    function setUp() public {
        g = new AgentPolicyGuardModule();
        vm.prank(acct);
        g.registerAgent(acct);
        vm.prank(acct);
        g.transferRootOwner(acct, owner);
        vm.prank(owner);
        g.setTargetPolicy(acct, target, 100e6, true, 0);
    }

    function test_register_once() public {
        vm.prank(acct);
        vm.expectRevert(AgentPolicyGuardModule.AlreadyRegistered.selector);
        g.registerAgent(acct);
    }

    function test_cannot_squat_someone_elses_account() public {
        address victim = address(0x71C71);
        vm.prank(stranger);
        vm.expectRevert(AgentPolicyGuardModule.MustClaimOwnAccount.selector);
        g.registerAgent(victim);
    }

    function test_only_root_owner_sets_policy() public {
        vm.prank(stranger);
        vm.expectRevert(AgentPolicyGuardModule.NotRootOwner.selector);
        g.setTargetPolicy(acct, target, 1, true, 0);
    }

    function test_stranger_cannot_burn_limit() public {
        vm.prank(stranger);
        vm.expectRevert(AgentPolicyGuardModule.NotAuthorizedCaller.selector);
        g.checkAndRecordSpend(acct, target, 1e6);
    }

    function test_spend_within_limit_then_blocked() public {
        vm.prank(acct);
        assertTrue(g.checkAndRecordSpend(acct, target, 60e6));
        vm.prank(acct);
        assertFalse(g.checkAndRecordSpend(acct, target, 50e6)); // exceeds 100
        assertEq(g.blockedCount(acct), 1);
        assertEq(g.totalBlocked(), 1);
        (bool ok, uint8 reason, uint256 remaining) = g.simulateSpend(acct, target, 50e6);
        assertFalse(ok);
        assertEq(reason, g.LIMIT_EXCEEDED());
        assertEq(remaining, 40e6);
    }

    function test_not_whitelisted_blocked() public {
        vm.prank(acct);
        assertFalse(g.checkAndRecordSpend(acct, address(0xBEEF), 1));
        (, uint8 reason,) = g.simulateSpend(acct, address(0xBEEF), 1);
        assertEq(reason, g.NOT_WHITELISTED());
    }

    function test_window_resets_after_24h() public {
        vm.prank(acct);
        g.checkAndRecordSpend(acct, target, 100e6);
        vm.warp(block.timestamp + 1 days);
        vm.prank(acct);
        assertTrue(g.checkAndRecordSpend(acct, target, 100e6));
    }

    function test_expired_policy() public {
        vm.prank(owner);
        g.setTargetPolicy(acct, target, 100e6, true, uint64(block.timestamp + 1 hours));
        vm.warp(block.timestamp + 2 hours);
        (bool ok, uint8 reason,) = g.simulateSpend(acct, target, 1);
        assertFalse(ok);
        assertEq(reason, g.POLICY_EXPIRED());
    }

    function test_revoke() public {
        vm.prank(owner);
        g.revokePolicy(acct, target);
        (bool ok,,) = g.simulateSpend(acct, target, 1);
        assertFalse(ok);
    }

    function testFuzz_never_exceeds_limit(uint128 a, uint128 b) public {
        vm.startPrank(acct);
        g.checkAndRecordSpend(acct, target, a);
        g.checkAndRecordSpend(acct, target, b);
        vm.stopPrank();
        (, uint256 spent,,,) = g.policies(acct, target);
        assertLe(spent, 100e6);
    }

    function test_validateUserOp_owner_and_session_key() public {
        (address ownerAddr, uint256 ownerPk) = makeAddrAndKey("rootOwner");
        (address sk, uint256 skPk) = makeAddrAndKey("sessionKey");
        address a2 = address(0xA2);
        vm.prank(a2);
        g.registerAgent(a2);
        vm.prank(a2);
        g.transferRootOwner(a2, ownerAddr);

        bytes32 h = keccak256("userop");
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, digest);
        assertEq(g.validateUserOp(h, abi.encode(a2, abi.encodePacked(r, s, v))), 0);

        (v, r, s) = vm.sign(skPk, digest);
        bytes memory skSig = abi.encode(a2, abi.encodePacked(r, s, v));
        assertEq(g.validateUserOp(h, skSig), 1); // not authorized yet

        vm.prank(ownerAddr);
        g.setSessionKey(a2, sk, uint64(block.timestamp + 1 hours));
        assertEq(g.validateUserOp(h, skSig), 0);

        vm.warp(block.timestamp + 2 hours);
        assertEq(g.validateUserOp(h, skSig), 1); // expired

        // malleable (high-s) twin of a valid owner signature must be rejected
        (v, r, s) = vm.sign(ownerPk, digest);
        bytes32 highS = bytes32(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;
        assertEq(g.validateUserOp(h, abi.encode(a2, abi.encodePacked(r, highS, flippedV))), 1);
        assertEq(g.validateUserOp(h, hex"00"), 1); // malformed
    }
}
