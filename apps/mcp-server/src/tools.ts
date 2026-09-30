import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPublicClient, encodeFunctionData, formatUnits, http, keccak256, parseAbi, parseUnits, toHex } from "viem";
import { sepolia } from "viem/chains";
import { z } from "zod";

const REGISTRY = (process.env.REGISTRY_ADDRESS ?? "0x4479E9A39d0Afa14Cb369DB895762C4C1C09410A") as `0x${string}`;
const ESCROW = (process.env.ESCROW_ADDRESS ?? "0xa6DefDFA9F974Bd0f3c14FB0A24f308Fa771e38e") as `0x${string}`;
const GUARD = (process.env.POLICY_GUARD_ADDRESS ?? "0x74518502325Aac333e47E5075828EC114C385a0b") as `0x${string}`;
const RPC = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

const client = createPublicClient({ chain: sepolia, transport: http(RPC) });

const registryAbi = parseAbi([
  "function agents(uint256) view returns (address owner, bytes32 teeAttestationHash, string name, string capabilities, string metadataURI, uint8 validation, bool isActive, uint64 registeredAt, uint32 tasksCompleted, uint32 ratingCount, uint64 ratingTotal, bytes32 memoryRoot, string memoryURI)",
  "function reputationBps(uint256) view returns (uint256)",
  "function commitMemoryRoot(uint256 agentId, bytes32 root, string uri)",
]);
const escrowAbi = parseAbi([
  "function tasks(uint256) view returns (address client, uint256 agentId, address paymentToken, uint256 bounty, uint64 deadline, uint64 submittedAt, uint8 status, bool rated, string taskDataURI, bytes32 resultHash, bytes32 attestationHash)",
  "function submitResult(uint256 taskId, bytes32 resultHash, bytes32 attestationHash)",
]);
const guardAbi = parseAbi([
  "function policies(address agentAccount, address target) view returns (uint256 dailySpendLimit, uint256 spentToday, uint256 lastResetTimestamp, bool isTargetWhitelisted, uint64 expiresAt)",
  "function simulateSpend(address agentAccount, address target, uint256 value) view returns (bool allowed, uint8 reason, uint256 remaining)",
]);

const ZERO = "0x0000000000000000000000000000000000000000";
const STATUS = ["Created", "Assigned", "Submitted", "Completed", "Disputed", "Refunded", "Resolved"];
const VALIDATION = ["TEE", "zkTLS", "Optimistic"];
const REASONS = ["ok", "target_not_whitelisted", "policy_expired", "daily_limit_exceeded"];

const json = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);
const ok = (v: unknown) => ({ content: [{ type: "text" as const, text: json(v) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });
const errMsg = (e: unknown) => (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");
const uintStr = z.string().regex(/^\d+$/, "must be a positive integer");

/** Builds a ZeroAgent MCP server. Every tool is read-only or returns unsigned calldata (non-custodial). */
export function createServer() {
  const server = new McpServer({ name: "zero-agent", version: "1.1.0" });

  server.registerTool(
    "verify_agent_identity",
    {
      title: "Verify agent identity",
      description: "Reads the on-chain agent registry: owner, validation type, capabilities, reputation and active status.",
      inputSchema: { agentId: uintStr.describe("Agent ID in the registry (1-indexed)") },
    },
    async ({ agentId }) => {
      try {
        const a = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: "agents", args: [BigInt(agentId)] });
        if (a[0] === ZERO) return fail(`Agent ${agentId} does not exist`);
        const rep = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: "reputationBps", args: [BigInt(agentId)] });
        return ok({
          agentId, name: a[2], owner: a[0], isActive: a[6], validation: VALIDATION[a[5]], capabilities: a[3].split(",").filter(Boolean),
          attestationHash: a[1], metadataURI: a[4], tasksCompleted: a[8], ratings: a[9],
          reputationPercent: a[9] === 0 ? null : Number(rep) / 100, memoryRoot: a[11], registry: REGISTRY,
        });
      } catch (e) {
        return fail(errMsg(e));
      }
    }
  );

  server.registerTool(
    "get_escrow_task",
    {
      title: "Get escrow task",
      description: "Reads a task from TaskEscrow: client, assigned agent, bounty, deadline, status and proof hashes.",
      inputSchema: { taskId: uintStr.describe("Escrow task ID (1-indexed)") },
    },
    async ({ taskId }) => {
      try {
        const t = await client.readContract({ address: ESCROW, abi: escrowAbi, functionName: "tasks", args: [BigInt(taskId)] });
        if (t[0] === ZERO) return fail(`Task ${taskId} does not exist`);
        return ok({
          taskId, client: t[0], agentId: t[1], token: t[2], bountyUsdc: formatUnits(t[3], 6), deadline: new Date(Number(t[4]) * 1000).toISOString(),
          status: STATUS[t[6]], rated: t[7], taskDataURI: t[8], resultHash: t[9], attestationHash: t[10], escrow: ESCROW,
        });
      } catch (e) {
        return fail(errMsg(e));
      }
    }
  );

  server.registerTool(
    "check_policy_limit",
    {
      title: "Check policy limit",
      description: "Reads the ERC-7579 guard policy for an agent account and target: daily cap, spent, whitelist and expiry.",
      inputSchema: { agentAccount: address, target: address },
    },
    async ({ agentAccount, target }) => {
      try {
        const [limit, spent, lastReset, whitelisted, expiresAt] = await client.readContract({
          address: GUARD, abi: guardAbi, functionName: "policies", args: [agentAccount as `0x${string}`, target as `0x${string}`],
        });
        const windowOver = BigInt(Math.floor(Date.now() / 1000)) >= lastReset + 86400n;
        const eff = windowOver ? 0n : spent;
        return ok({
          policyGuard: GUARD, whitelisted, dailyLimitUsdc: formatUnits(limit, 6), spentTodayUsdc: formatUnits(eff, 6),
          remainingUsdc: formatUnits(limit > eff ? limit - eff : 0n, 6), expiresAt: expiresAt === 0n ? null : new Date(Number(expiresAt) * 1000).toISOString(),
        });
      } catch (e) {
        return fail(errMsg(e));
      }
    }
  );

  server.registerTool(
    "simulate_policy_spend",
    {
      title: "Simulate policy spend",
      description: "Dry-runs a spend against the on-chain policy and explains why it would pass or be blocked. Changes no state.",
      inputSchema: { agentAccount: address, target: address, amountUsdc: z.string().describe("Amount in USDC, e.g. \"25.5\"") },
    },
    async ({ agentAccount, target, amountUsdc }) => {
      try {
        const amount = parseUnits(amountUsdc, 6);
        const [allowed, reason, remaining] = await client.readContract({
          address: GUARD, abi: guardAbi, functionName: "simulateSpend", args: [agentAccount as `0x${string}`, target as `0x${string}`, amount],
        });
        return ok({ allowed, reason: REASONS[reason], remainingAfterUsdc: formatUnits(remaining, 6), policyGuard: GUARD });
      } catch (e) {
        return fail(errMsg(e));
      }
    }
  );

  server.registerTool(
    "prepare_submit_attested_task",
    {
      title: "Prepare attested task submission",
      description:
        "Validates that a task is assigned and returns unsigned calldata for TaskEscrow.submitResult (hashes of the output and TEE quote). The agent owner signs and sends it — this server never holds keys.",
      inputSchema: {
        taskId: uintStr,
        output: z.string().describe("Raw task output; keccak256 of it is committed"),
        attestationQuote: z.string().describe("Hex-encoded TEE/zkTLS quote; keccak256 of it is committed"),
      },
    },
    async ({ taskId, output, attestationQuote }) => {
      try {
        const t = await client.readContract({ address: ESCROW, abi: escrowAbi, functionName: "tasks", args: [BigInt(taskId)] });
        if (t[0] === ZERO) return fail(`Task ${taskId} does not exist`);
        if (t[6] !== 1) return fail(`Task ${taskId} is ${STATUS[t[6]]}; only Assigned tasks accept results`);
        const resultHash = keccak256(toHex(output));
        const attestationHash = keccak256(/^0x[0-9a-fA-F]*$/.test(attestationQuote) ? (attestationQuote as `0x${string}`) : toHex(attestationQuote));
        return ok({
          to: ESCROW, value: "0", resultHash, attestationHash,
          data: encodeFunctionData({ abi: escrowAbi, functionName: "submitResult", args: [BigInt(taskId), resultHash, attestationHash] }),
          note: "Must be sent by the owner of the assigned agent before the task deadline.",
        });
      } catch (e) {
        return fail(errMsg(e));
      }
    }
  );

  server.registerTool(
    "prepare_commit_memory_root",
    {
      title: "Prepare memory-root commit",
      description: "Hashes a memory snapshot and returns unsigned calldata for AgentIdentityRegistry.commitMemoryRoot. The agent owner signs and sends it.",
      inputSchema: { agentId: uintStr, content: z.string().describe("Memory snapshot content or its serialized form"), uri: z.string().optional().describe("Storage URI (ipfs://…); defaults to mem://<root>") },
    },
    async ({ agentId, content, uri }) => {
      try {
        const a = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: "agents", args: [BigInt(agentId)] });
        if (a[0] === ZERO) return fail(`Agent ${agentId} does not exist`);
        const root = keccak256(toHex(content));
        return ok({
          to: REGISTRY, value: "0", root, owner: a[0],
          data: encodeFunctionData({ abi: registryAbi, functionName: "commitMemoryRoot", args: [BigInt(agentId), root, uri ?? `mem://${root}`] }),
          note: "Only the agent owner can send this transaction.",
        });
      } catch (e) {
        return fail(errMsg(e));
      }
    }
  );

  return server;
}
