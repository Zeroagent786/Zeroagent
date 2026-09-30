// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentIdentityRegistry
 * @notice Simplified ERC-8004 style registry: sovereign agent identities, validation type,
 *         portable reputation and verifiable memory-root commitments.
 * @dev Reputation is only writable by the linked TaskEscrow so it cannot be self-issued.
 */
contract AgentIdentityRegistry {
    // --- Types ---

    /// @dev 0 = TEE enclave attested, 1 = zkTLS verified, 2 = optimistic / stake-backed
    enum ValidationType { TEE, ZkTLS, Optimistic }

    struct Agent {
        address owner;
        bytes32 teeAttestationHash;
        string name;
        string capabilities; // comma separated tags, e.g. "defi-arbitrage,mcp-stdio"
        string metadataURI;
        ValidationType validation;
        bool isActive;
        uint64 registeredAt;
        uint32 tasksCompleted;
        uint32 ratingCount;
        uint64 ratingTotal;
        bytes32 memoryRoot;
        string memoryURI;
    }

    // --- Errors ---

    error InvalidAttestation();
    error EmptyName();
    error AgentNotFound();
    error NotAgentOwner();
    error NotEscrow();
    error EscrowAlreadySet();
    error NotDeployer();
    error InvalidScore();
    error NameTaken();
    error NameTooLong();
    error ZeroAddress();

    // --- State ---

    mapping(uint256 => Agent) public agents;
    uint256 public agentCount;

    address public immutable deployer;
    address public escrow;

    /// @notice keccak256 of the lower-cased name => taken. Prevents exact/case-variant impersonation.
    mapping(bytes32 => bool) public nameTaken;

    // --- Events ---

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string name, bytes32 teeAttestationHash);
    event AgentStatusUpdated(uint256 indexed agentId, bool isActive);
    event AgentMetadataUpdated(uint256 indexed agentId, string newMetadataURI);
    event MemoryRootCommitted(uint256 indexed agentId, bytes32 root, string uri);
    event ReputationUpdated(uint256 indexed agentId, uint32 tasksCompleted, uint32 ratingCount, uint64 ratingTotal);
    event EscrowLinked(address escrow);

    constructor() {
        deployer = msg.sender;
    }

    // --- Modifiers ---

    modifier agentExists(uint256 agentId) {
        if (agents[agentId].registeredAt == 0) revert AgentNotFound();
        _;
    }

    modifier onlyAgentOwner(uint256 agentId) {
        if (agents[agentId].registeredAt == 0) revert AgentNotFound();
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        _;
    }

    modifier onlyEscrow() {
        if (msg.sender != escrow) revert NotEscrow();
        _;
    }

    // --- Setup ---

    /// @notice Links the escrow contract allowed to write reputation. Callable once by the deployer.
    /// @param escrow_ Address of the TaskEscrow.
    function setEscrow(address escrow_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (escrow != address(0)) revert EscrowAlreadySet();
        if (escrow_ == address(0)) revert ZeroAddress();
        escrow = escrow_;
        emit EscrowLinked(escrow_);
    }

    // --- Agent lifecycle ---

    /**
     * @notice Registers a new AI agent.
     * @param name Human readable agent name.
     * @param capabilities Comma separated capability tags.
     * @param validation How this agent's work is validated.
     * @param teeAttestationHash Hash of the enclave attestation / identity commitment (non-zero).
     * @param metadataURI IPFS/Arweave URI for the extended registration card.
     * @return agentId The newly minted agent id (1-indexed).
     */
    function registerAgent(
        string calldata name,
        string calldata capabilities,
        ValidationType validation,
        bytes32 teeAttestationHash,
        string calldata metadataURI
    ) external returns (uint256 agentId) {
        if (teeAttestationHash == bytes32(0)) revert InvalidAttestation();
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(name).length > 64) revert NameTooLong();
        bytes32 nameKey = keccak256(bytes(_lower(name)));
        if (nameTaken[nameKey]) revert NameTaken();
        nameTaken[nameKey] = true;

        agentId = ++agentCount;
        Agent storage a = agents[agentId];
        a.owner = msg.sender;
        a.teeAttestationHash = teeAttestationHash;
        a.name = name;
        a.capabilities = capabilities;
        a.metadataURI = metadataURI;
        a.validation = validation;
        a.isActive = true;
        a.registeredAt = uint64(block.timestamp);

        emit AgentRegistered(agentId, msg.sender, name, teeAttestationHash);
    }

    /// @notice Activates or deactivates an agent.
    /// @param agentId Agent id.
    /// @param isActive New status.
    function setAgentStatus(uint256 agentId, bool isActive) external onlyAgentOwner(agentId) {
        agents[agentId].isActive = isActive;
        emit AgentStatusUpdated(agentId, isActive);
    }

    /// @notice Updates the registration card URI.
    /// @param agentId Agent id.
    /// @param newMetadataURI New URI.
    function updateMetadataURI(uint256 agentId, string calldata newMetadataURI) external onlyAgentOwner(agentId) {
        agents[agentId].metadataURI = newMetadataURI;
        emit AgentMetadataUpdated(agentId, newMetadataURI);
    }

    /// @notice Anchors the hash of the agent's decoupled (IPFS/Arweave) memory on-chain.
    /// @param agentId Agent id.
    /// @param root Merkle/content root of the memory snapshot.
    /// @param uri Storage URI of the snapshot.
    function commitMemoryRoot(uint256 agentId, bytes32 root, string calldata uri) external onlyAgentOwner(agentId) {
        agents[agentId].memoryRoot = root;
        agents[agentId].memoryURI = uri;
        emit MemoryRootCommitted(agentId, root, uri);
    }

    // --- Reputation (escrow only) ---

    /// @notice Records a completed (paid) task for an agent.
    /// @param agentId Agent id.
    function recordCompletion(uint256 agentId) external onlyEscrow agentExists(agentId) {
        Agent storage a = agents[agentId];
        a.tasksCompleted += 1;
        emit ReputationUpdated(agentId, a.tasksCompleted, a.ratingCount, a.ratingTotal);
    }

    /// @notice Records a client rating (1-5) for an agent.
    /// @param agentId Agent id.
    /// @param score Rating between 1 and 5.
    function recordRating(uint256 agentId, uint8 score) external onlyEscrow agentExists(agentId) {
        if (score < 1 || score > 5) revert InvalidScore();
        Agent storage a = agents[agentId];
        a.ratingCount += 1;
        a.ratingTotal += score;
        emit ReputationUpdated(agentId, a.tasksCompleted, a.ratingCount, a.ratingTotal);
    }

    function _lower(string calldata s) private pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory o = new bytes(b.length);
        for (uint256 i; i < b.length; ++i) {
            uint8 c = uint8(b[i]);
            o[i] = (c >= 65 && c <= 90) ? bytes1(c + 32) : b[i];
        }
        return string(o);
    }

    // --- Views ---

    /// @notice Whether the agent exists and is active.
    /// @param agentId Agent id.
    /// @return True if the agent is active.
    function isAgentActive(uint256 agentId) external view returns (bool) {
        return agents[agentId].isActive;
    }

    /// @notice Owner of an agent (zero address if unknown).
    /// @param agentId Agent id.
    /// @return The owner address.
    function ownerOf(uint256 agentId) external view returns (address) {
        return agents[agentId].owner;
    }

    /// @notice Reputation in basis points (10000 = perfect 5/5). Zero when unrated.
    /// @param agentId Agent id.
    /// @return Reputation score in basis points.
    function reputationBps(uint256 agentId) external view returns (uint256) {
        Agent storage a = agents[agentId];
        if (a.ratingCount == 0) return 0;
        return (uint256(a.ratingTotal) * 10000) / (uint256(a.ratingCount) * 5);
    }
}
