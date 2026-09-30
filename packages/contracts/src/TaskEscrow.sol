// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentityRegistry} from "./AgentIdentityRegistry.sol";

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @dev EIP-3009 "receiveWithAuthorization" (USDC). Lets a task be funded with a single signature.
interface IEIP3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title TaskEscrow
 * @notice ERC-20 escrow for agent work: lock -> assign -> submit attested result -> release / dispute / refund.
 * @dev Follows checks-effects-interactions and is guarded against reentrancy.
 */
contract TaskEscrow {
    // --- Types ---

    enum TaskStatus { Created, Assigned, Submitted, Completed, Disputed, Refunded, Resolved }

    struct Task {
        address client;
        uint256 agentId;
        address paymentToken;
        uint256 bounty;
        uint64 deadline;
        uint64 submittedAt;
        TaskStatus status;
        bool rated;
        string taskDataURI;
        bytes32 resultHash;
        bytes32 attestationHash;
    }

    // --- Errors ---

    error ZeroBounty();
    error InvalidDeadline();
    error NotClient();
    error NotAgentOwner();
    error NotArbiter();
    error InvalidStatus();
    error AgentInactive();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error ReviewWindowOpen();
    error ReviewWindowClosed();
    error TransferFailed();
    error EmptyResult();
    error AlreadyRated();
    error NotRatable();
    error Reentrancy();
    error ZeroAddress();
    error TokenNotAllowed();
    error SelfDealing();
    error ArbiterIsParty();
    error DisputeTimeoutNotReached();
    error NotPendingArbiter();

    // --- Constants / State ---

    /// @notice Time a client has to verify or dispute a submitted result.
    uint64 public constant REVIEW_WINDOW = 3 days;
    /// @notice If the arbiter does not settle a dispute within this time anyone can split the funds 50/50.
    uint64 public constant DISPUTE_TIMEOUT = 14 days;

    AgentIdentityRegistry public immutable registry;
    address public arbiter;
    address public pendingArbiter;

    /// @notice Only allow-listed payment tokens (USDC) can be escrowed.
    mapping(address => bool) public allowedTokens;
    mapping(uint256 => uint64) public disputedAt;

    mapping(uint256 => Task) public tasks;
    uint256 public taskCount;

    uint256 private _lock = 1;

    // --- Events ---

    event TaskCreated(uint256 indexed taskId, address indexed client, address token, uint256 bounty, uint64 deadline, string taskDataURI);
    event TaskAssigned(uint256 indexed taskId, uint256 indexed agentId);
    event ResultSubmitted(uint256 indexed taskId, uint256 indexed agentId, bytes32 resultHash, bytes32 attestationHash);
    event FundsReleased(uint256 indexed taskId, address indexed to, uint256 amount);
    event TaskDisputed(uint256 indexed taskId, address indexed client);
    event DisputeResolved(uint256 indexed taskId, bool paidAgent);
    event TaskRefunded(uint256 indexed taskId, address indexed client, uint256 amount);
    event AgentRated(uint256 indexed taskId, uint256 indexed agentId, uint8 score);
    event ArbiterChanged(address indexed newArbiter);
    event ArbiterProposed(address indexed newArbiter);
    event TokenAllowed(address indexed token, bool allowed);
    event StaleDisputeSplit(uint256 indexed taskId, uint256 toAgent, uint256 toClient);

    // --- Modifiers ---

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier onlyClient(uint256 taskId) {
        if (tasks[taskId].client != msg.sender) revert NotClient();
        _;
    }

    constructor(address registry_, address token_) {
        if (registry_ == address(0) || token_ == address(0)) revert ZeroAddress();
        registry = AgentIdentityRegistry(registry_);
        arbiter = msg.sender;
        allowedTokens[token_] = true;
        emit TokenAllowed(token_, true);
    }

    // --- Creation ---

    /**
     * @notice Creates a task and escrows the bounty (requires prior ERC-20 approval).
     * @param paymentToken ERC-20 used for payment (USDC).
     * @param bounty Amount to lock.
     * @param deadline Unix timestamp by which work must be done.
     * @param taskDataURI URI with the task description / verification criteria.
     * @param agentId Agent to assign immediately (0 = leave open).
     * @return taskId The new task id.
     */
    function createTask(address paymentToken, uint256 bounty, uint64 deadline, string calldata taskDataURI, uint256 agentId)
        external
        nonReentrant
        returns (uint256 taskId)
    {
        _validateNew(paymentToken, bounty, deadline);
        _safeTransferFrom(paymentToken, msg.sender, address(this), bounty);
        taskId = _create(paymentToken, bounty, deadline, taskDataURI, agentId);
    }

    /**
     * @notice Creates a task funded through an EIP-3009 signature (no separate approve transaction).
     * @param paymentToken EIP-3009 token (USDC).
     * @param bounty Amount to lock.
     * @param deadline Unix timestamp by which work must be done.
     * @param taskDataURI URI with the task description / verification criteria.
     * @param agentId Agent to assign immediately (0 = leave open).
     * @param validAfter Authorization valid-after timestamp.
     * @param validBefore Authorization valid-before timestamp.
     * @param nonce Random 32 byte authorization nonce.
     * @param v Signature v.
     * @param r Signature r.
     * @param s Signature s.
     * @return taskId The new task id.
     */
    function createTaskWithAuthorization(
        address paymentToken,
        uint256 bounty,
        uint64 deadline,
        string calldata taskDataURI,
        uint256 agentId,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant returns (uint256 taskId) {
        _validateNew(paymentToken, bounty, deadline);
        IEIP3009(paymentToken).receiveWithAuthorization(msg.sender, address(this), bounty, validAfter, validBefore, nonce, v, r, s);
        taskId = _create(paymentToken, bounty, deadline, taskDataURI, agentId);
    }

    function _validateNew(address token, uint256 bounty, uint64 deadline) private view {
        if (!allowedTokens[token]) revert TokenNotAllowed();
        if (bounty == 0) revert ZeroBounty();
        if (deadline <= block.timestamp) revert InvalidDeadline();
    }

    function _create(address token, uint256 bounty, uint64 deadline, string calldata uri, uint256 agentId)
        private
        returns (uint256 taskId)
    {
        taskId = ++taskCount;
        Task storage t = tasks[taskId];
        t.client = msg.sender;
        t.paymentToken = token;
        t.bounty = bounty;
        t.deadline = deadline;
        t.taskDataURI = uri;
        emit TaskCreated(taskId, msg.sender, token, bounty, deadline, uri);

        if (agentId != 0) _assign(taskId, agentId);
    }

    // --- Lifecycle ---

    /// @notice Assigns an active agent to an open task.
    /// @param taskId Task id.
    /// @param agentId Agent id.
    function assignAgent(uint256 taskId, uint256 agentId) external onlyClient(taskId) {
        if (tasks[taskId].status != TaskStatus.Created) revert InvalidStatus();
        _assign(taskId, agentId);
    }

    function _assign(uint256 taskId, uint256 agentId) private {
        if (!registry.isAgentActive(agentId)) revert AgentInactive();
        Task storage t = tasks[taskId];
        if (registry.ownerOf(agentId) == t.client) revert SelfDealing();
        t.agentId = agentId;
        t.status = TaskStatus.Assigned;
        emit TaskAssigned(taskId, agentId);
    }

    /// @notice Assigned agent's owner submits the result hash and attestation commitment.
    /// @param taskId Task id.
    /// @param resultHash Hash of the task output.
    /// @param attestationHash Hash of the TEE / zkTLS attestation quote.
    function submitResult(uint256 taskId, bytes32 resultHash, bytes32 attestationHash) external {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Assigned) revert InvalidStatus();
        if (registry.ownerOf(t.agentId) != msg.sender) revert NotAgentOwner();
        if (block.timestamp > t.deadline) revert DeadlinePassed();
        if (resultHash == bytes32(0) || attestationHash == bytes32(0)) revert EmptyResult();

        t.resultHash = resultHash;
        t.attestationHash = attestationHash;
        t.submittedAt = uint64(block.timestamp);
        t.status = TaskStatus.Submitted;
        emit ResultSubmitted(taskId, t.agentId, resultHash, attestationHash);
    }

    /// @notice Client verifies the attested result and releases payment to the agent owner.
    /// @param taskId Task id.
    function releaseFunds(uint256 taskId) external nonReentrant onlyClient(taskId) {
        if (tasks[taskId].status != TaskStatus.Submitted) revert InvalidStatus();
        _payAgent(taskId, TaskStatus.Completed);
    }

    /// @notice Agent owner claims the bounty if the client did not review within the review window.
    /// @param taskId Task id.
    function claimBounty(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Submitted) revert InvalidStatus();
        if (registry.ownerOf(t.agentId) != msg.sender) revert NotAgentOwner();
        if (block.timestamp < t.submittedAt + REVIEW_WINDOW) revert ReviewWindowOpen();
        _payAgent(taskId, TaskStatus.Completed);
    }

    /// @notice Client disputes a submitted result within the review window.
    /// @param taskId Task id.
    function disputeTask(uint256 taskId) external onlyClient(taskId) {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Submitted) revert InvalidStatus();
        if (block.timestamp >= t.submittedAt + REVIEW_WINDOW) revert ReviewWindowClosed();
        t.status = TaskStatus.Disputed;
        disputedAt[taskId] = uint64(block.timestamp);
        emit TaskDisputed(taskId, msg.sender);
    }

    /// @notice Arbiter settles a dispute.
    /// @param taskId Task id.
    /// @param payAgent True to pay the agent, false to refund the client.
    function resolveDispute(uint256 taskId, bool payAgent) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Disputed) revert InvalidStatus();
        if (msg.sender == t.client || msg.sender == registry.ownerOf(t.agentId)) revert ArbiterIsParty();
        emit DisputeResolved(taskId, payAgent);
        if (payAgent) {
            _payAgent(taskId, TaskStatus.Resolved);
        } else {
            _refund(taskId, TaskStatus.Resolved);
        }
    }

    /// @notice Client reclaims funds when work was not submitted before the deadline.
    /// @param taskId Task id.
    function claimExpired(uint256 taskId) external nonReentrant onlyClient(taskId) {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Created && t.status != TaskStatus.Assigned) revert InvalidStatus();
        if (block.timestamp <= t.deadline) revert DeadlineNotPassed();
        _refund(taskId, TaskStatus.Refunded);
    }

    /// @notice Client rates the agent (1-5) after a paid task. One rating per task.
    /// @param taskId Task id.
    /// @param score Rating 1-5.
    function rateAgent(uint256 taskId, uint8 score) external onlyClient(taskId) {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Completed) revert NotRatable();
        if (t.rated) revert AlreadyRated();
        t.rated = true;
        registry.recordRating(t.agentId, score);
        emit AgentRated(taskId, t.agentId, score);
    }

    /// @notice Anyone can settle a dispute the arbiter ignored for DISPUTE_TIMEOUT: funds split 50/50.
    /// @param taskId Task id.
    function resolveStaleDispute(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Disputed) revert InvalidStatus();
        if (block.timestamp < disputedAt[taskId] + DISPUTE_TIMEOUT) revert DisputeTimeoutNotReached();
        t.status = TaskStatus.Resolved;
        uint256 toAgent = t.bounty / 2;
        uint256 toClient = t.bounty - toAgent;
        address agentOwner = registry.ownerOf(t.agentId);
        if (toAgent > 0) _safeTransfer(t.paymentToken, agentOwner, toAgent);
        _safeTransfer(t.paymentToken, t.client, toClient);
        emit StaleDisputeSplit(taskId, toAgent, toClient);
    }

    /// @notice Proposes a new arbiter (two-step handover; the proposed address must accept).
    /// @param newArbiter Proposed arbiter.
    function proposeArbiter(address newArbiter) external {
        if (msg.sender != arbiter) revert NotArbiter();
        if (newArbiter == address(0)) revert ZeroAddress();
        pendingArbiter = newArbiter;
        emit ArbiterProposed(newArbiter);
    }

    /// @notice Completes the arbiter handover.
    function acceptArbiter() external {
        if (msg.sender != pendingArbiter) revert NotPendingArbiter();
        arbiter = msg.sender;
        pendingArbiter = address(0);
        emit ArbiterChanged(msg.sender);
    }

    /// @notice Arbiter manages the payment-token allow-list.
    /// @param token ERC-20 address.
    /// @param allowed Whether it can be escrowed.
    function setTokenAllowed(address token, bool allowed) external {
        if (msg.sender != arbiter) revert NotArbiter();
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    // --- Internals ---

    function _payAgent(uint256 taskId, TaskStatus finalStatus) private {
        Task storage t = tasks[taskId];
        t.status = finalStatus;
        address to = registry.ownerOf(t.agentId);
        uint256 amount = t.bounty;
        _safeTransfer(t.paymentToken, to, amount);
        registry.recordCompletion(t.agentId);
        emit FundsReleased(taskId, to, amount);
    }

    function _refund(uint256 taskId, TaskStatus finalStatus) private {
        Task storage t = tasks[taskId];
        t.status = finalStatus;
        uint256 amount = t.bounty;
        _safeTransfer(t.paymentToken, t.client, amount);
        emit TaskRefunded(taskId, t.client, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeCall(IERC20Minimal.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeCall(IERC20Minimal.transferFrom, (from, to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
