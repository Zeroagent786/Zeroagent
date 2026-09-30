import { parseAbi } from "viem";

export const CHAIN_ID = 11155111;
export const REGISTRY_ADDRESS = "0x4479E9A39d0Afa14Cb369DB895762C4C1C09410A" as const;
export const ESCROW_ADDRESS = "0xa6DefDFA9F974Bd0f3c14FB0A24f308Fa771e38e" as const;
export const POLICY_GUARD_ADDRESS = "0x74518502325Aac333e47E5075828EC114C385a0b" as const;
/** ZeroAgent's funded stablecoin on the demo network (6 decimals, EIP-3009). */
export const USDC_ADDRESS = "0x615E800a31c3cC30727569A498949E5F041B8Df4" as const;
export const USDC_DECIMALS = 6;
export const DEPLOY_BLOCK = 11813590n;

export const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
export const EXPLORER = "https://sepolia.etherscan.io";
export const USDC_FAUCET = "https://faucet.circle.com/";
export const ETH_FAUCET = "https://cloud.google.com/application/web3/faucet/ethereum/sepolia";

export const registryAbi = parseAbi([
  "function agentCount() view returns (uint256)",
  "function agents(uint256) view returns (address owner, bytes32 teeAttestationHash, string name, string capabilities, string metadataURI, uint8 validation, bool isActive, uint64 registeredAt, uint32 tasksCompleted, uint32 ratingCount, uint64 ratingTotal, bytes32 memoryRoot, string memoryURI)",
  "function reputationBps(uint256) view returns (uint256)",
  "function registerAgent(string name, string capabilities, uint8 validation, bytes32 teeAttestationHash, string metadataURI) returns (uint256)",
  "function setAgentStatus(uint256 agentId, bool isActive)",
  "function commitMemoryRoot(uint256 agentId, bytes32 root, string uri)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string name, bytes32 teeAttestationHash)",
  "event MemoryRootCommitted(uint256 indexed agentId, bytes32 root, string uri)",
]);

export const escrowAbi = parseAbi([
  "function taskCount() view returns (uint256)",
  "function tasks(uint256) view returns (address client, uint256 agentId, address paymentToken, uint256 bounty, uint64 deadline, uint64 submittedAt, uint8 status, bool rated, string taskDataURI, bytes32 resultHash, bytes32 attestationHash)",
  "function REVIEW_WINDOW() view returns (uint64)",
  "function createTask(address paymentToken, uint256 bounty, uint64 deadline, string taskDataURI, uint256 agentId) returns (uint256)",
  "function createTaskWithAuthorization(address paymentToken, uint256 bounty, uint64 deadline, string taskDataURI, uint256 agentId, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) returns (uint256)",
  "function assignAgent(uint256 taskId, uint256 agentId)",
  "function submitResult(uint256 taskId, bytes32 resultHash, bytes32 attestationHash)",
  "function releaseFunds(uint256 taskId)",
  "function claimBounty(uint256 taskId)",
  "function disputeTask(uint256 taskId)",
  "function claimExpired(uint256 taskId)",
  "function rateAgent(uint256 taskId, uint8 score)",
  "function resolveStaleDispute(uint256 taskId)",
  "function disputedAt(uint256) view returns (uint64)",
  "function DISPUTE_TIMEOUT() view returns (uint64)",
  "event TaskCreated(uint256 indexed taskId, address indexed client, address token, uint256 bounty, uint64 deadline, string taskDataURI)",
  "event TaskAssigned(uint256 indexed taskId, uint256 indexed agentId)",
  "event ResultSubmitted(uint256 indexed taskId, uint256 indexed agentId, bytes32 resultHash, bytes32 attestationHash)",
  "event FundsReleased(uint256 indexed taskId, address indexed to, uint256 amount)",
  "event TaskDisputed(uint256 indexed taskId, address indexed client)",
  "event TaskRefunded(uint256 indexed taskId, address indexed client, uint256 amount)",
]);

export const guardAbi = parseAbi([
  "function policies(address agentAccount, address target) view returns (uint256 dailySpendLimit, uint256 spentToday, uint256 lastResetTimestamp, bool isTargetWhitelisted, uint64 expiresAt)",
  "function agentRootOwners(address agentAccount) view returns (address)",
  "function sessionKeys(address agentAccount, address key) view returns (uint64)",
  "function blockedCount(address agentAccount) view returns (uint256)",
  "function totalBlocked() view returns (uint256)",
  "function simulateSpend(address agentAccount, address target, uint256 value) view returns (bool allowed, uint8 reason, uint256 remaining)",
  "function registerAgent(address agentAccount)",
  "function setTargetPolicy(address agentAccount, address target, uint256 dailySpendLimit, bool isWhitelisted, uint64 expiresAt)",
  "function revokePolicy(address agentAccount, address target)",
  "function setSessionKey(address agentAccount, address key, uint64 expiresAt)",
  "function checkAndRecordSpend(address agentAccount, address target, uint256 value) returns (bool)",
  "event AgentAccountRegistered(address indexed agentAccount, address indexed rootOwner)",
  "event PolicyUpdated(address indexed agentAccount, address indexed target, uint256 dailyLimit, bool whitelisted, uint64 expiresAt)",
  "event PolicyRevoked(address indexed agentAccount, address indexed target)",
  "event PolicyTriggered(address indexed agentAccount, address indexed target, uint256 amount)",
  "event SpendBlocked(address indexed agentAccount, address indexed target, uint256 amount, uint8 reason)",
  "event SessionKeySet(address indexed agentAccount, address indexed key, uint64 expiresAt)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/** EIP-712 domain of Circle USDC on Sepolia (verified on-chain: name "USDC", version "2"). */
export const usdcDomain = {
  name: "USD Coin",
  version: "2",
  chainId: CHAIN_ID,
  verifyingContract: USDC_ADDRESS,
} as const;

export const receiveWithAuthorizationTypes = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export const TASK_STATUS = ["Created", "Assigned", "Submitted", "Completed", "Disputed", "Refunded", "Resolved"] as const;
export type TaskStatusName = (typeof TASK_STATUS)[number];
export const VALIDATION = ["TEE Enclave Attested", "zkTLS Verified", "Optimistic Stake-backed"] as const;
export const BLOCK_REASONS = ["Allowed", "Target not whitelisted", "Policy expired", "Exceeds 24h spend limit"] as const;

export type Agent = {
  id: number;
  owner: `0x${string}`;
  teeHash: `0x${string}`;
  name: string;
  capabilities: string[];
  uri: string;
  validation: number;
  active: boolean;
  registeredAt: number;
  tasksCompleted: number;
  ratingCount: number;
  ratingTotal: number;
  memoryRoot: `0x${string}`;
  memoryURI: string;
  /** 0-100, null when unrated */
  reputation: number | null;
};

export type Task = {
  id: number;
  client: `0x${string}`;
  agentId: number;
  token: `0x${string}`;
  bounty: bigint;
  deadline: number;
  submittedAt: number;
  status: number;
  rated: boolean;
  uri: string;
  resultHash: `0x${string}`;
  attestationHash: `0x${string}`;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
