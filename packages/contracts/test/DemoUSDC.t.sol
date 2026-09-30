// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {DemoUSDC} from "../src/DemoUSDC.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {TaskEscrow} from "../src/TaskEscrow.sol";

contract DemoUSDCTest is Test {
    DemoUSDC t;
    address minter = address(0xFA0CE7);
    address bob = address(0xB0B);
    uint256 alicePk = 0xA11CE;
    address alice;

    uint256 constant N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function setUp() public {
        vm.warp(1_000_000);
        t = new DemoUSDC();
        alice = vm.addr(alicePk);
        t.setMinter(minter);
        t.mint(alice, 1000e6);
    }

    // --- metadata / admin ---
    function test_metadata() public view {
        assertEq(t.name(), "USD Coin");
        assertEq(t.symbol(), "USDC");
        assertEq(t.decimals(), 6);
        assertEq(t.version(), "2");
        assertEq(t.owner(), address(this));
    }

    function test_domainSeparator_matches_eip712() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("USD Coin"),
                keccak256("2"),
                block.chainid,
                address(t)
            )
        );
        assertEq(t.DOMAIN_SEPARATOR(), expected);
    }

    function test_mint_permissions() public {
        vm.prank(minter);
        t.mint(bob, 5e6);
        assertEq(t.balanceOf(bob), 5e6);
        t.mint(bob, 1e6); // owner
        assertEq(t.totalSupply(), 1006e6);
        vm.prank(bob);
        vm.expectRevert(DemoUSDC.NotAuthorizedToMint.selector);
        t.mint(bob, 1);
        vm.expectRevert(DemoUSDC.ZeroAddress.selector);
        t.mint(address(0), 1);
    }

    function test_setMinter_onlyOwner_and_revoke() public {
        vm.prank(bob);
        vm.expectRevert(DemoUSDC.NotOwner.selector);
        t.setMinter(bob);
        t.setMinter(address(0));
        vm.prank(minter);
        vm.expectRevert(DemoUSDC.NotAuthorizedToMint.selector);
        t.mint(bob, 1);
    }

    function test_transferOwnership() public {
        vm.prank(bob);
        vm.expectRevert(DemoUSDC.NotOwner.selector);
        t.transferOwnership(bob);
        vm.expectRevert(DemoUSDC.ZeroAddress.selector);
        t.transferOwnership(address(0));
        t.transferOwnership(bob);
        assertEq(t.owner(), bob);
        vm.expectRevert(DemoUSDC.NotOwner.selector);
        t.setMinter(alice);
    }

    // --- ERC-20 ---
    function test_transfer_basic_and_reverts() public {
        vm.prank(alice);
        assertTrue(t.transfer(bob, 100e6));
        assertEq(t.balanceOf(bob), 100e6);
        vm.prank(alice);
        vm.expectRevert(DemoUSDC.InsufficientBalance.selector);
        t.transfer(bob, 10_000e6);
        vm.prank(alice);
        vm.expectRevert(DemoUSDC.ZeroAddress.selector);
        t.transfer(address(0), 1);
    }

    function test_allowance_flow() public {
        vm.prank(alice);
        t.approve(bob, 50e6);
        vm.prank(bob);
        t.transferFrom(alice, bob, 30e6);
        assertEq(t.allowance(alice, bob), 20e6);
        vm.prank(bob);
        vm.expectRevert(DemoUSDC.InsufficientAllowance.selector);
        t.transferFrom(alice, bob, 21e6);
    }

    function test_allowance_infinite_not_decremented() public {
        vm.prank(alice);
        t.approve(bob, type(uint256).max);
        vm.prank(bob);
        t.transferFrom(alice, bob, 30e6);
        assertEq(t.allowance(alice, bob), type(uint256).max);
    }

    function test_transferFrom_zero_allowance_zero_amount_ok() public {
        vm.prank(bob);
        assertTrue(t.transferFrom(alice, bob, 0));
    }

    function test_transferFrom_balance_revert_after_allowance() public {
        vm.prank(alice);
        t.approve(bob, 5000e6);
        vm.prank(bob);
        vm.expectRevert(DemoUSDC.InsufficientBalance.selector);
        t.transferFrom(alice, bob, 2000e6);
    }

    function testFuzz_transfer_conserves(address to, uint256 minted, uint256 amt) public {
        vm.assume(to != address(0) && to != alice);
        minted = bound(minted, 0, type(uint128).max);
        t.mint(alice, minted);
        uint256 aBal = t.balanceOf(alice);
        amt = bound(amt, 0, aBal);
        uint256 supply = t.totalSupply();
        vm.prank(alice);
        t.transfer(to, amt);
        assertEq(t.balanceOf(alice) + t.balanceOf(to), aBal);
        assertEq(t.balanceOf(to), amt);
        assertEq(t.totalSupply(), supply);
    }

    // --- EIP-3009 helpers ---
    function _sign(uint256 pk, bytes32 typehash, address from, address to, uint256 value, uint256 va, uint256 vb, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(abi.encode(typehash, from, to, value, va, vb, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function _signT(uint256 pk, address to, uint256 value, uint256 va, uint256 vb, bytes32 nonce)
        internal
        view
        returns (uint8, bytes32, bytes32)
    {
        return _sign(pk, t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), vm.addr(pk), to, value, va, vb, nonce);
    }

    function _signR(uint256 pk, address to, uint256 value, uint256 va, uint256 vb, bytes32 nonce)
        internal
        view
        returns (uint8, bytes32, bytes32)
    {
        return _sign(pk, t.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), vm.addr(pk), to, value, va, vb, nonce);
    }

    // --- EIP-3009 ---
    function test_transferWithAuthorization() public {
        bytes32 n = keccak256("n1");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 10e6, 0, block.timestamp + 1 hours, n);
        vm.prank(address(0xCAFE)); // relayer
        t.transferWithAuthorization(alice, bob, 10e6, 0, block.timestamp + 1 hours, n, v, r, s);
        assertEq(t.balanceOf(bob), 10e6);
        assertTrue(t.authorizationState(alice, n));
    }

    function test_receiveWithAuthorization() public {
        bytes32 n = keccak256("n2");
        (uint8 v, bytes32 r, bytes32 s) = _signR(alicePk, bob, 10e6, 0, block.timestamp + 1 hours, n);
        vm.prank(bob);
        t.receiveWithAuthorization(alice, bob, 10e6, 0, block.timestamp + 1 hours, n, v, r, s);
        assertEq(t.balanceOf(bob), 10e6);
    }

    function test_receive_wrong_caller() public {
        bytes32 n = keccak256("n3");
        (uint8 v, bytes32 r, bytes32 s) = _signR(alicePk, bob, 10e6, 0, block.timestamp + 1 hours, n);
        vm.prank(address(0xBAD));
        vm.expectRevert(DemoUSDC.CallerMustBePayee.selector);
        t.receiveWithAuthorization(alice, bob, 10e6, 0, block.timestamp + 1 hours, n, v, r, s);
    }

    function test_typehash_mismatch_transfer_sig_on_receive() public {
        bytes32 n = keccak256("n4");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 10e6, 0, block.timestamp + 1 hours, n);
        vm.prank(bob);
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        t.receiveWithAuthorization(alice, bob, 10e6, 0, block.timestamp + 1 hours, n, v, r, s);
    }

    function test_expired() public {
        bytes32 n = keccak256("n5");
        uint256 vb = block.timestamp + 100;
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 1e6, 0, vb, n);
        vm.warp(vb);
        vm.expectRevert(DemoUSDC.AuthorizationExpired.selector);
        t.transferWithAuthorization(alice, bob, 1e6, 0, vb, n, v, r, s);
    }

    function test_not_yet_valid() public {
        bytes32 n = keccak256("n6");
        uint256 va = 1_000_100;
        uint256 vb = 1_002_000;
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 1e6, va, vb, n);
        vm.expectRevert(DemoUSDC.AuthorizationNotYetValid.selector);
        t.transferWithAuthorization(alice, bob, 1e6, va, vb, n, v, r, s);
        vm.warp(va); // boundary: still not valid (strict)
        vm.expectRevert(DemoUSDC.AuthorizationNotYetValid.selector);
        t.transferWithAuthorization(alice, bob, 1e6, va, vb, n, v, r, s);
        vm.warp(va + 1);
        t.transferWithAuthorization(alice, bob, 1e6, va, vb, n, v, r, s);
    }

    function test_replay() public {
        bytes32 n = keccak256("n7");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 1e6, 0, block.timestamp + 1 hours, n);
        t.transferWithAuthorization(alice, bob, 1e6, 0, block.timestamp + 1 hours, n, v, r, s);
        vm.expectRevert(DemoUSDC.AuthorizationAlreadyUsed.selector);
        t.transferWithAuthorization(alice, bob, 1e6, 0, block.timestamp + 1 hours, n, v, r, s);
    }

    function test_cancelled() public {
        bytes32 n = keccak256("n8");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 1e6, 0, block.timestamp + 1 hours, n);
        (uint8 cv, bytes32 cr, bytes32 cs) = vm.sign(
            alicePk,
            keccak256(
                abi.encodePacked(
                    "\x19\x01", t.DOMAIN_SEPARATOR(), keccak256(abi.encode(t.CANCEL_AUTHORIZATION_TYPEHASH(), alice, n))
                )
            )
        );
        t.cancelAuthorization(alice, n, cv, cr, cs);
        assertTrue(t.authorizationState(alice, n));
        vm.expectRevert(DemoUSDC.AuthorizationAlreadyUsed.selector);
        t.transferWithAuthorization(alice, bob, 1e6, 0, block.timestamp + 1 hours, n, v, r, s);
        // cannot cancel twice
        vm.expectRevert(DemoUSDC.AuthorizationAlreadyUsed.selector);
        t.cancelAuthorization(alice, n, cv, cr, cs);
    }

    function test_cancel_wrong_signer() public {
        bytes32 n = keccak256("n9");
        (uint8 cv, bytes32 cr, bytes32 cs) = vm.sign(
            0xBEEF,
            keccak256(
                abi.encodePacked(
                    "\x19\x01", t.DOMAIN_SEPARATOR(), keccak256(abi.encode(t.CANCEL_AUTHORIZATION_TYPEHASH(), alice, n))
                )
            )
        );
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        t.cancelAuthorization(alice, n, cv, cr, cs);
    }

    function test_wrong_signer() public {
        bytes32 n = keccak256("n10");
        (uint8 v, bytes32 r, bytes32 s) = _signT(0xBEEF, bob, 1e6, 0, block.timestamp + 1 hours, n);
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        t.transferWithAuthorization(alice, bob, 1e6, 0, block.timestamp + 1 hours, n, v, r, s);
    }

    function test_tampered_value() public {
        bytes32 n = keccak256("n11");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 1e6, 0, block.timestamp + 1 hours, n);
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        t.transferWithAuthorization(alice, bob, 2e6, 0, block.timestamp + 1 hours, n, v, r, s);
    }

    function test_malleable_high_s_rejected() public {
        bytes32 n = keccak256("n12");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 1e6, 0, block.timestamp + 1 hours, n);
        bytes32 s2 = bytes32(N - uint256(s));
        uint8 v2 = v == 27 ? 28 : 27;
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        t.transferWithAuthorization(alice, bob, 1e6, 0, block.timestamp + 1 hours, n, v2, r, s2);
        // original still works
        t.transferWithAuthorization(alice, bob, 1e6, 0, block.timestamp + 1 hours, n, v, r, s);
    }

    function test_bad_v_rejected() public {
        bytes32 n = keccak256("n13");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 1e6, 0, block.timestamp + 1 hours, n);
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        t.transferWithAuthorization(alice, bob, 1e6, 0, block.timestamp + 1 hours, n, v - 27, r, s);
    }

    function test_zero_signature_rejected() public {
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        t.transferWithAuthorization(address(0), bob, 0, 0, block.timestamp + 1, bytes32(0), 27, bytes32(uint256(1)), bytes32(uint256(1)));
    }

    function test_insufficient_balance_does_not_burn_nonce() public {
        bytes32 n = keccak256("n14");
        (uint8 v, bytes32 r, bytes32 s) = _signT(alicePk, bob, 5000e6, 0, block.timestamp + 1 hours, n);
        vm.expectRevert(DemoUSDC.InsufficientBalance.selector);
        t.transferWithAuthorization(alice, bob, 5000e6, 0, block.timestamp + 1 hours, n, v, r, s);
        assertFalse(t.authorizationState(alice, n));
    }
}

contract DemoUSDCEscrowIntegrationTest is Test {
    DemoUSDC usdc;
    AgentIdentityRegistry reg;
    TaskEscrow esc;
    uint256 clientPk = 0xC11E;
    address client;
    address worker = address(0xB0B);
    uint256 agentId;

    function setUp() public {
        vm.warp(1_000_000);
        usdc = new DemoUSDC();
        reg = new AgentIdentityRegistry();
        esc = new TaskEscrow(address(reg), address(usdc));
        reg.setEscrow(address(esc));
        client = vm.addr(clientPk);
        usdc.mint(client, 100e6);
        vm.prank(worker);
        agentId = reg.registerAgent("W", "x", AgentIdentityRegistry.ValidationType.TEE, keccak256("w"), "u");
    }

    function _sig(uint256 bounty, uint256 vb, bytes32 nonce) internal view returns (uint8, bytes32, bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(usdc.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), client, address(esc), bounty, uint256(0), vb, nonce)
        );
        return vm.sign(clientPk, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
    }

    function test_createTaskWithAuthorization_full_lifecycle() public {
        uint256 bounty = 25e6;
        uint256 vb = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("task-nonce");
        (uint8 v, bytes32 r, bytes32 s) = _sig(bounty, vb, nonce);

        vm.prank(client);
        uint256 id = esc.createTaskWithAuthorization(
            address(usdc), bounty, uint64(block.timestamp + 1 days), "ipfs://t", agentId, 0, vb, nonce, v, r, s
        );
        assertEq(usdc.balanceOf(address(esc)), bounty);
        assertEq(usdc.balanceOf(client), 75e6);
        assertTrue(usdc.authorizationState(client, nonce));

        vm.prank(worker);
        esc.submitResult(id, keccak256("out"), keccak256("quote"));
        vm.prank(client);
        esc.releaseFunds(id);
        assertEq(usdc.balanceOf(worker), bounty);
        assertEq(usdc.balanceOf(address(esc)), 0);

        // replaying the same signature fails
        vm.prank(client);
        vm.expectRevert(DemoUSDC.AuthorizationAlreadyUsed.selector);
        esc.createTaskWithAuthorization(
            address(usdc), bounty, uint64(block.timestamp + 1 days), "ipfs://t", agentId, 0, vb, nonce, v, r, s
        );
    }

    function test_signature_not_usable_by_other_caller() public {
        uint256 vb = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("n");
        (uint8 v, bytes32 r, bytes32 s) = _sig(10e6, vb, nonce);
        vm.prank(address(0xBAD)); // escrow would use msg.sender as `from`
        vm.expectRevert(DemoUSDC.InvalidSignature.selector);
        esc.createTaskWithAuthorization(address(usdc), 10e6, uint64(block.timestamp + 1 days), "u", 0, 0, vb, nonce, v, r, s);
    }
}
