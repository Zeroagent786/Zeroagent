// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {TaskEscrow} from "../src/TaskEscrow.sol";

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(bytes32 => bool) public used;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) {
        require(balanceOf[msg.sender] >= a, "bal");
        balanceOf[msg.sender] -= a; balanceOf[to] += a; return true;
    }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        require(balanceOf[f] >= a && allowance[f][msg.sender] >= a, "bal/allow");
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[t] += a; return true;
    }
    // Simplified EIP-3009: signature check omitted, replay protection kept.
    function receiveWithAuthorization(address f, address t, uint256 a, uint256 va, uint256 vb, bytes32 n, uint8, bytes32, bytes32) external {
        require(msg.sender == t, "caller must be payee");
        require(block.timestamp > va && block.timestamp < vb, "auth window");
        require(!used[n], "used");
        used[n] = true;
        require(balanceOf[f] >= a, "bal");
        balanceOf[f] -= a; balanceOf[t] += a;
    }
}

contract TaskEscrowTest is Test {
    AgentIdentityRegistry reg;
    TaskEscrow esc;
    MockUSDC usdc;

    address client = address(0xC11E);
    address worker = address(0xB0B);
    uint256 constant BOUNTY = 25e6;
    uint256 agentId;

    function setUp() public {
        reg = new AgentIdentityRegistry();
        usdc = new MockUSDC();
        esc = new TaskEscrow(address(reg), address(usdc));
        reg.setEscrow(address(esc));
        usdc.mint(client, 1000e6);
        vm.prank(client);
        usdc.approve(address(esc), type(uint256).max);
        vm.prank(worker);
        agentId = reg.registerAgent("W", "x", AgentIdentityRegistry.ValidationType.TEE, keccak256("w"), "u");
    }

    function _create(uint256 assignTo) internal returns (uint256 id) {
        vm.prank(client);
        id = esc.createTask(address(usdc), BOUNTY, uint64(block.timestamp + 1 days), "ipfs://t", assignTo);
    }

    function _status(uint256 id) internal view returns (TaskEscrow.TaskStatus s) {
        (, , , , , , s, , , , ) = esc.tasks(id);
    }

    function test_happy_path_and_reputation() public {
        uint256 id = _create(agentId);
        assertEq(usdc.balanceOf(address(esc)), BOUNTY);
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Assigned);

        vm.prank(worker);
        esc.submitResult(id, keccak256("out"), keccak256("quote"));
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Submitted);

        vm.prank(client);
        esc.releaseFunds(id);
        assertEq(usdc.balanceOf(worker), BOUNTY);
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Completed);

        vm.prank(client);
        esc.rateAgent(id, 5);
        assertEq(reg.reputationBps(agentId), 10000);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.AlreadyRated.selector);
        esc.rateAgent(id, 5);
    }

    function test_open_task_then_assign() public {
        uint256 id = _create(0);
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Created);
        vm.prank(client);
        esc.assignAgent(id, agentId);
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Assigned);
    }

    function test_cannot_release_before_submission() public {
        uint256 id = _create(agentId);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.InvalidStatus.selector);
        esc.releaseFunds(id);
    }

    function test_only_client_and_only_agent_owner() public {
        uint256 id = _create(agentId);
        vm.expectRevert(TaskEscrow.NotClient.selector);
        esc.assignAgent(id, agentId);
        vm.expectRevert(TaskEscrow.NotAgentOwner.selector);
        esc.submitResult(id, keccak256("o"), keccak256("q"));
    }

    function test_inactive_agent_rejected() public {
        vm.prank(worker);
        reg.setAgentStatus(agentId, false);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.AgentInactive.selector);
        esc.createTask(address(usdc), BOUNTY, uint64(block.timestamp + 1 days), "u", agentId);
    }

    function test_expired_refund() public {
        uint256 id = _create(agentId);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.DeadlineNotPassed.selector);
        esc.claimExpired(id);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(worker);
        vm.expectRevert(TaskEscrow.DeadlinePassed.selector);
        esc.submitResult(id, keccak256("o"), keccak256("q"));

        vm.prank(client);
        esc.claimExpired(id);
        assertEq(usdc.balanceOf(client), 1000e6);
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Refunded);
    }

    function test_dispute_paths() public {
        uint256 id = _create(agentId);
        vm.prank(worker);
        esc.submitResult(id, keccak256("o"), keccak256("q"));
        vm.prank(client);
        esc.disputeTask(id);

        vm.prank(client);
        vm.expectRevert(TaskEscrow.NotArbiter.selector);
        esc.resolveDispute(id, false);

        esc.resolveDispute(id, false); // this contract is arbiter
        assertEq(usdc.balanceOf(client), 1000e6);

        uint256 id2 = _create(agentId);
        vm.prank(worker);
        esc.submitResult(id2, keccak256("o"), keccak256("q"));
        vm.prank(client);
        esc.disputeTask(id2);
        esc.resolveDispute(id2, true);
        assertEq(usdc.balanceOf(worker), BOUNTY);
    }

    function test_agent_claims_after_review_window() public {
        uint256 id = _create(agentId);
        vm.prank(worker);
        esc.submitResult(id, keccak256("o"), keccak256("q"));

        vm.prank(worker);
        vm.expectRevert(TaskEscrow.ReviewWindowOpen.selector);
        esc.claimBounty(id);

        vm.warp(block.timestamp + 3 days);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.ReviewWindowClosed.selector);
        esc.disputeTask(id);

        vm.prank(worker);
        esc.claimBounty(id);
        assertEq(usdc.balanceOf(worker), BOUNTY);
    }

    function test_eip3009_funding() public {
        vm.prank(client);
        uint256 id = esc.createTaskWithAuthorization(
            address(usdc), BOUNTY, uint64(block.timestamp + 1 days), "u", agentId,
            0, block.timestamp + 1 hours, keccak256("n1"), 27, bytes32(0), bytes32(0)
        );
        assertEq(usdc.balanceOf(address(esc)), BOUNTY);
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Assigned);

        vm.prank(client);
        vm.expectRevert(bytes("used"));
        esc.createTaskWithAuthorization(
            address(usdc), BOUNTY, uint64(block.timestamp + 1 days), "u", agentId,
            0, block.timestamp + 1 hours, keccak256("n1"), 27, bytes32(0), bytes32(0)
        );
    }

    function test_zero_bounty_and_bad_deadline() public {
        vm.startPrank(client);
        vm.expectRevert(TaskEscrow.ZeroBounty.selector);
        esc.createTask(address(usdc), 0, uint64(block.timestamp + 1), "u", 0);
        vm.expectRevert(TaskEscrow.InvalidDeadline.selector);
        esc.createTask(address(usdc), 1, uint64(block.timestamp), "u", 0);
        vm.stopPrank();
    }

    function testFuzz_escrow_conserves_funds(uint96 amount) public {
        amount = uint96(bound(amount, 1, 1000e6));
        vm.prank(client);
        uint256 id = esc.createTask(address(usdc), amount, uint64(block.timestamp + 1 days), "u", agentId);
        vm.prank(worker);
        esc.submitResult(id, keccak256("o"), keccak256("q"));
        vm.prank(client);
        esc.releaseFunds(id);
        assertEq(usdc.balanceOf(address(esc)), 0);
        assertEq(usdc.balanceOf(worker), amount);
        assertEq(usdc.balanceOf(client), 1000e6 - amount);
    }

    // ---- hardening ----

    function test_self_dealing_blocked() public {
        // client owns the agent it is trying to hire
        vm.prank(client);
        uint256 own = reg.registerAgent("Mine", "x", AgentIdentityRegistry.ValidationType.TEE, keccak256("m"), "u");
        vm.prank(client);
        vm.expectRevert(TaskEscrow.SelfDealing.selector);
        esc.createTask(address(usdc), BOUNTY, uint64(block.timestamp + 1 days), "u", own);

        uint256 id = _create(0);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.SelfDealing.selector);
        esc.assignAgent(id, own);
    }

    function test_token_allowlist() public {
        MockUSDC fake = new MockUSDC();
        fake.mint(client, 100e6);
        vm.startPrank(client);
        fake.approve(address(esc), type(uint256).max);
        vm.expectRevert(TaskEscrow.TokenNotAllowed.selector);
        esc.createTask(address(fake), 1e6, uint64(block.timestamp + 1 days), "u", 0);
        vm.stopPrank();

        esc.setTokenAllowed(address(fake), true);
        vm.prank(client);
        esc.createTask(address(fake), 1e6, uint64(block.timestamp + 1 days), "u", 0);

        vm.prank(client);
        vm.expectRevert(TaskEscrow.NotArbiter.selector);
        esc.setTokenAllowed(address(fake), false);
    }

    function _disputed() internal returns (uint256 id) {
        id = _create(agentId);
        vm.prank(worker);
        esc.submitResult(id, keccak256("o"), keccak256("q"));
        vm.prank(client);
        esc.disputeTask(id);
    }

    function test_stale_dispute_splits_after_timeout() public {
        uint256 id = _disputed();
        vm.expectRevert(TaskEscrow.DisputeTimeoutNotReached.selector);
        esc.resolveStaleDispute(id);

        vm.warp(block.timestamp + 14 days);
        vm.prank(address(0xDEAD)); // anyone
        esc.resolveStaleDispute(id);
        assertEq(usdc.balanceOf(worker), BOUNTY / 2);
        assertEq(usdc.balanceOf(client), 1000e6 - BOUNTY / 2);
        assertEq(usdc.balanceOf(address(esc)), 0);
        assertTrue(_status(id) == TaskEscrow.TaskStatus.Resolved);

        vm.expectRevert(TaskEscrow.InvalidStatus.selector);
        esc.resolveStaleDispute(id); // no double pay
    }

    function test_arbiter_cannot_be_party() public {
        uint256 id = _disputed();
        esc.proposeArbiter(client);
        vm.prank(client);
        esc.acceptArbiter();
        vm.prank(client);
        vm.expectRevert(TaskEscrow.ArbiterIsParty.selector);
        esc.resolveDispute(id, false);
    }

    function test_two_step_arbiter_handover() public {
        address next = address(0xABCD);
        esc.proposeArbiter(next);
        assertEq(esc.arbiter(), address(this));
        vm.expectRevert(TaskEscrow.NotPendingArbiter.selector);
        esc.acceptArbiter();
        vm.prank(next);
        esc.acceptArbiter();
        assertEq(esc.arbiter(), next);
        vm.expectRevert(TaskEscrow.NotArbiter.selector);
        esc.proposeArbiter(address(1));
    }

    function test_no_double_settlement() public {
        uint256 id = _create(agentId);
        vm.prank(worker);
        esc.submitResult(id, keccak256("o"), keccak256("q"));
        vm.prank(client);
        esc.releaseFunds(id);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.InvalidStatus.selector);
        esc.releaseFunds(id);
        vm.prank(client);
        vm.expectRevert(TaskEscrow.InvalidStatus.selector);
        esc.claimExpired(id);
        vm.prank(worker);
        vm.expectRevert(TaskEscrow.InvalidStatus.selector);
        esc.claimBounty(id);
    }
}

/// @dev Stateful fuzzing: however tasks are driven, the escrow always holds >= sum of unsettled bounties.
contract EscrowInvariantHandler is Test {
    TaskEscrow public esc;
    MockUSDC public usdc;
    AgentIdentityRegistry public reg;
    address client = address(0xC11E);
    address worker = address(0xB0B);
    uint256 public agentId;
    uint256[] public ids;

    constructor(TaskEscrow e, MockUSDC u, AgentIdentityRegistry r, uint256 a) {
        esc = e; usdc = u; reg = r; agentId = a;
        u.mint(client, 1e12);
        vm.prank(client);
        u.approve(address(e), type(uint256).max);
    }

    function create(uint96 amt, bool assign) external {
        amt = uint96(bound(amt, 1, 1e9));
        vm.prank(client);
        ids.push(esc.createTask(address(usdc), amt, uint64(block.timestamp + 1 days), "u", assign ? agentId : 0));
    }

    function act(uint256 seed, uint8 op) external {
        if (ids.length == 0) return;
        uint256 id = ids[seed % ids.length];
        op = op % 7;
        if (op == 0) { vm.prank(worker); try esc.submitResult(id, keccak256("o"), keccak256("q")) {} catch {} }
        else if (op == 1) { vm.prank(client); try esc.releaseFunds(id) {} catch {} }
        else if (op == 2) { vm.prank(client); try esc.disputeTask(id) {} catch {} }
        else if (op == 3) { vm.prank(client); try esc.claimExpired(id) {} catch {} }
        else if (op == 4) { vm.prank(worker); try esc.claimBounty(id) {} catch {} }
        else if (op == 5) { try esc.resolveStaleDispute(id) {} catch {} }
        else { vm.warp(block.timestamp + (seed % 5 days)); }
    }

    function unsettled() external view returns (uint256 sum) {
        for (uint256 i; i < ids.length; ++i) {
            (, , , uint256 bounty, , , TaskEscrow.TaskStatus s, , , , ) = esc.tasks(ids[i]);
            if (s == TaskEscrow.TaskStatus.Created || s == TaskEscrow.TaskStatus.Assigned || s == TaskEscrow.TaskStatus.Submitted || s == TaskEscrow.TaskStatus.Disputed) sum += bounty;
        }
    }
}

contract EscrowInvariantTest is Test {
    EscrowInvariantHandler h;
    MockUSDC usdc;
    TaskEscrow esc;

    function setUp() public {
        AgentIdentityRegistry reg = new AgentIdentityRegistry();
        usdc = new MockUSDC();
        esc = new TaskEscrow(address(reg), address(usdc));
        reg.setEscrow(address(esc));
        vm.prank(address(0xB0B));
        uint256 a = reg.registerAgent("W", "x", AgentIdentityRegistry.ValidationType.TEE, keccak256("w"), "u");
        h = new EscrowInvariantHandler(esc, usdc, reg, a);
        targetContract(address(h));
    }

    /// Solvency: escrow balance always covers every unsettled bounty, and nothing is ever minted out of thin air.
    function invariant_escrow_is_solvent() public view {
        assertEq(usdc.balanceOf(address(esc)), h.unsettled());
    }
}
