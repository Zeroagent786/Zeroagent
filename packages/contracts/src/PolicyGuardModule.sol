// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IValidationModule {
    function validateUserOp(bytes32 userOpHash, bytes calldata signature) external view returns (uint256);
}

/**
 * @title AgentPolicyGuardModule
 * @notice ERC-7579 style policy firewall: per-target whitelists, rolling 24h spend caps,
 *         policy expiry and scoped session keys for autonomous agents.
 * @dev Out-of-policy spends do not revert: they are recorded as blocked so that the
 *      enforcement history is verifiable on-chain.
 */
contract AgentPolicyGuardModule is IValidationModule {
    struct PolicyConfig {
        uint256 dailySpendLimit;
        uint256 spentToday;
        uint256 lastResetTimestamp;
        bool isTargetWhitelisted;
        uint64 expiresAt; // 0 = never
    }

    /// @dev Reason codes returned by simulateSpend / emitted in SpendBlocked.
    uint8 public constant OK = 0;
    uint8 public constant NOT_WHITELISTED = 1;
    uint8 public constant POLICY_EXPIRED = 2;
    uint8 public constant LIMIT_EXCEEDED = 3;

    uint256 private constant SIG_VALIDATION_FAILED = 1;

    error AlreadyRegistered();
    error NotRootOwner();
    error NotAuthorizedCaller();
    error ZeroAddress();
    error MustClaimOwnAccount();
    error InvalidSignature();

    // Agent account => target contract => policy
    mapping(address => mapping(address => PolicyConfig)) public policies;
    mapping(address => address) public agentRootOwners;
    // Agent account => session key => expiry (0 = not a session key)
    mapping(address => mapping(address => uint64)) public sessionKeys;
    mapping(address => uint256) public blockedCount;
    uint256 public totalBlocked;

    event AgentAccountRegistered(address indexed agentAccount, address indexed rootOwner);
    event RootOwnerTransferred(address indexed agentAccount, address indexed newOwner);
    event PolicyUpdated(address indexed agentAccount, address indexed target, uint256 dailyLimit, bool whitelisted, uint64 expiresAt);
    event PolicyRevoked(address indexed agentAccount, address indexed target);
    event PolicyTriggered(address indexed agentAccount, address indexed target, uint256 amount);
    event SpendBlocked(address indexed agentAccount, address indexed target, uint256 amount, uint8 reason);
    event SessionKeySet(address indexed agentAccount, address indexed key, uint64 expiresAt);

    modifier onlyRootOwner(address agentAccount) {
        if (msg.sender != agentRootOwners[agentAccount]) revert NotRootOwner();
        _;
    }

    /// @notice Claims an agent account; only the account itself may claim (prevents address squatting).
    ///         Afterwards root ownership can be handed to a separate owner via transferRootOwner.
    /// @param agentAccount The smart account / agent address to protect (must equal msg.sender).
    function registerAgent(address agentAccount) external {
        if (agentAccount == address(0)) revert ZeroAddress();
        if (agentAccount != msg.sender) revert MustClaimOwnAccount();
        if (agentRootOwners[agentAccount] != address(0)) revert AlreadyRegistered();
        agentRootOwners[agentAccount] = msg.sender;
        emit AgentAccountRegistered(agentAccount, msg.sender);
    }

    /// @notice Transfers root ownership of an agent account.
    /// @param agentAccount Agent account.
    /// @param newOwner New root owner.
    function transferRootOwner(address agentAccount, address newOwner) external onlyRootOwner(agentAccount) {
        if (newOwner == address(0)) revert ZeroAddress();
        agentRootOwners[agentAccount] = newOwner;
        emit RootOwnerTransferred(agentAccount, newOwner);
    }

    /// @notice Sets (or replaces) the policy for an agent account and target.
    /// @param agentAccount Agent account.
    /// @param target Target contract the agent may spend on.
    /// @param dailySpendLimit Max amount per rolling 24h window (token base units).
    /// @param isWhitelisted Whether the target is allowed.
    /// @param expiresAt Policy expiry timestamp (0 = never).
    function setTargetPolicy(
        address agentAccount,
        address target,
        uint256 dailySpendLimit,
        bool isWhitelisted,
        uint64 expiresAt
    ) external onlyRootOwner(agentAccount) {
        policies[agentAccount][target] = PolicyConfig({
            dailySpendLimit: dailySpendLimit,
            spentToday: 0,
            lastResetTimestamp: block.timestamp,
            isTargetWhitelisted: isWhitelisted,
            expiresAt: expiresAt
        });
        emit PolicyUpdated(agentAccount, target, dailySpendLimit, isWhitelisted, expiresAt);
    }

    /// @notice Removes a policy entirely.
    /// @param agentAccount Agent account.
    /// @param target Target contract.
    function revokePolicy(address agentAccount, address target) external onlyRootOwner(agentAccount) {
        delete policies[agentAccount][target];
        emit PolicyRevoked(agentAccount, target);
    }

    /// @notice Authorizes a short-lived session key for an agent account.
    /// @param agentAccount Agent account.
    /// @param key Session key address.
    /// @param expiresAt Expiry timestamp (0 revokes the key).
    function setSessionKey(address agentAccount, address key, uint64 expiresAt) external onlyRootOwner(agentAccount) {
        sessionKeys[agentAccount][key] = expiresAt;
        emit SessionKeySet(agentAccount, key, expiresAt);
    }

    /// @notice Dry-runs a spend against the policy without changing state.
    /// @param agentAccount Agent account.
    /// @param target Target contract.
    /// @param value Amount to spend.
    /// @return allowed True if the spend would pass.
    /// @return reason Reason code (0 = ok).
    /// @return remaining Remaining allowance in the current window.
    function simulateSpend(address agentAccount, address target, uint256 value)
        public
        view
        returns (bool allowed, uint8 reason, uint256 remaining)
    {
        PolicyConfig memory p = policies[agentAccount][target];
        if (!p.isTargetWhitelisted) return (false, NOT_WHITELISTED, 0);
        if (p.expiresAt != 0 && block.timestamp > p.expiresAt) return (false, POLICY_EXPIRED, 0);

        uint256 spent = block.timestamp >= p.lastResetTimestamp + 1 days ? 0 : p.spentToday;
        remaining = p.dailySpendLimit > spent ? p.dailySpendLimit - spent : 0;
        if (value > remaining) return (false, LIMIT_EXCEEDED, remaining);
        return (true, OK, remaining - value);
    }

    /// @notice Validates a spend and records it. Blocked spends are logged, not reverted.
    /// @dev Only the agent account itself or its root owner may call (prevents burning someone's limit).
    /// @param agentAccount Agent account.
    /// @param target Target contract.
    /// @param value Amount to spend.
    /// @return True if the spend was allowed and recorded.
    function checkAndRecordSpend(address agentAccount, address target, uint256 value) external returns (bool) {
        if (msg.sender != agentAccount && msg.sender != agentRootOwners[agentAccount]) revert NotAuthorizedCaller();

        (bool allowed, uint8 reason,) = simulateSpend(agentAccount, target, value);
        if (!allowed) {
            blockedCount[agentAccount] += 1;
            totalBlocked += 1;
            emit SpendBlocked(agentAccount, target, value, reason);
            return false;
        }

        PolicyConfig storage p = policies[agentAccount][target];
        if (block.timestamp >= p.lastResetTimestamp + 1 days) {
            p.spentToday = 0;
            p.lastResetTimestamp = block.timestamp;
        }
        p.spentToday += value;
        emit PolicyTriggered(agentAccount, target, value);
        return true;
    }

    /// @notice ERC-4337 style validation: signature must be from the root owner or a live session key.
    /// @param userOpHash Hash being signed.
    /// @param signature abi.encode(address agentAccount, bytes sig65) over the eth-signed userOpHash.
    /// @return 0 if valid, 1 (SIG_VALIDATION_FAILED) otherwise.
    function validateUserOp(bytes32 userOpHash, bytes calldata signature) external view override returns (uint256) {
        if (signature.length < 96) return SIG_VALIDATION_FAILED;
        (address account, bytes memory sig) = abi.decode(signature, (address, bytes));
        if (sig.length != 65) return SIG_VALIDATION_FAILED;

        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        // reject malleable signatures (EIP-2) and bad recovery ids
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return SIG_VALIDATION_FAILED;
        if (v != 27 && v != 28) return SIG_VALIDATION_FAILED;
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) return SIG_VALIDATION_FAILED;
        if (signer == agentRootOwners[account]) return 0;
        uint64 exp = sessionKeys[account][signer];
        if (exp != 0 && block.timestamp <= exp) return 0;
        return SIG_VALIDATION_FAILED;
    }
}
