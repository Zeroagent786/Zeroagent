// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";

contract RegistryTest is Test {
    AgentIdentityRegistry reg;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        reg = new AgentIdentityRegistry();
    }

    uint256 private n;

    function _register(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = reg.registerAgent(string.concat("Bot", vm.toString(n++)), "defi,mcp", AgentIdentityRegistry.ValidationType.TEE, keccak256("x"), "ipfs://x");
    }

    function test_register_is_one_indexed() public {
        assertEq(_register(alice), 1);
        assertEq(_register(bob), 2);
        assertEq(reg.agentCount(), 2);
        assertEq(reg.ownerOf(1), alice);
        assertTrue(reg.isAgentActive(1));
    }

    function test_register_reverts() public {
        vm.expectRevert(AgentIdentityRegistry.InvalidAttestation.selector);
        reg.registerAgent("Bot", "", AgentIdentityRegistry.ValidationType.TEE, bytes32(0), "");
        vm.expectRevert(AgentIdentityRegistry.EmptyName.selector);
        reg.registerAgent("", "", AgentIdentityRegistry.ValidationType.TEE, keccak256("x"), "");
    }

    function test_only_owner_can_update() public {
        _register(alice);
        vm.prank(bob);
        vm.expectRevert(AgentIdentityRegistry.NotAgentOwner.selector);
        reg.setAgentStatus(1, false);

        vm.prank(alice);
        reg.setAgentStatus(1, false);
        assertFalse(reg.isAgentActive(1));

        vm.prank(alice);
        reg.commitMemoryRoot(1, keccak256("mem"), "ipfs://mem");
        (, , , , , , , , , , , bytes32 root, string memory uri) = reg.agents(1);
        assertEq(root, keccak256("mem"));
        assertEq(uri, "ipfs://mem");
    }

    function test_duplicate_and_case_variant_names_rejected() public {
        _register(alice); // "Bot0"
        vm.prank(bob);
        vm.expectRevert(AgentIdentityRegistry.NameTaken.selector);
        reg.registerAgent("bot0", "", AgentIdentityRegistry.ValidationType.TEE, keccak256("y"), "");
        vm.prank(bob);
        vm.expectRevert(AgentIdentityRegistry.NameTaken.selector);
        reg.registerAgent("BOT0", "", AgentIdentityRegistry.ValidationType.TEE, keccak256("y"), "");
    }

    function test_name_too_long() public {
        vm.expectRevert(AgentIdentityRegistry.NameTooLong.selector);
        reg.registerAgent("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "", AgentIdentityRegistry.ValidationType.TEE, keccak256("y"), "");
    }

    function test_setEscrow_zero_rejected() public {
        vm.expectRevert(AgentIdentityRegistry.ZeroAddress.selector);
        reg.setEscrow(address(0));
    }

    function test_unknown_agent_reverts() public {
        vm.expectRevert(AgentIdentityRegistry.AgentNotFound.selector);
        reg.setAgentStatus(9, true);
    }

    function test_reputation_only_escrow() public {
        _register(alice);
        vm.expectRevert(AgentIdentityRegistry.NotEscrow.selector);
        reg.recordCompletion(1);

        reg.setEscrow(address(this));
        reg.recordRating(1, 5);
        reg.recordRating(1, 4);
        assertEq(reg.reputationBps(1), 9000);
        vm.expectRevert(AgentIdentityRegistry.InvalidScore.selector);
        reg.recordRating(1, 6);
    }

    function test_setEscrow_once_and_only_deployer() public {
        vm.prank(alice);
        vm.expectRevert(AgentIdentityRegistry.NotDeployer.selector);
        reg.setEscrow(alice);
        reg.setEscrow(bob);
        vm.expectRevert(AgentIdentityRegistry.EscrowAlreadySet.selector);
        reg.setEscrow(alice);
    }
}
