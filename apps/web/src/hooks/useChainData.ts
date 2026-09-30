"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { decodeEventLog, type Log } from "viem";
import {
  DEPLOY_BLOCK,
  ESCROW_ADDRESS,
  POLICY_GUARD_ADDRESS,
  REGISTRY_ADDRESS,
  escrowAbi,
  guardAbi,
  registryAbi,
  type Agent,
  type Task,
} from "../lib/contracts";

export function useAgents() {
  const { data: count, isLoading: l1 } = useReadContract({ address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "agentCount" });
  const n = count ? Number(count) : 0;
  const { data, isLoading: l2, refetch } = useReadContracts({
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => [
      { address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "agents" as const, args: [BigInt(i + 1)] as const },
      { address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "reputationBps" as const, args: [BigInt(i + 1)] as const },
    ]).flat(),
    query: { enabled: n > 0 },
  });

  const agents: Agent[] = [];
  if (data) {
    for (let i = 0; i < n; i++) {
      const a = data[i * 2] as readonly [
        `0x${string}`, `0x${string}`, string, string, string, number, boolean, bigint, number, number, bigint, `0x${string}`, string
      ];
      const rep = data[i * 2 + 1] as bigint;
      agents.push({
        id: i + 1,
        owner: a[0],
        teeHash: a[1],
        name: a[2],
        capabilities: a[3].split(",").map((s) => s.trim()).filter(Boolean),
        uri: a[4],
        validation: Number(a[5]),
        active: a[6],
        registeredAt: Number(a[7]),
        tasksCompleted: Number(a[8]),
        ratingCount: Number(a[9]),
        ratingTotal: Number(a[10]),
        memoryRoot: a[11],
        memoryURI: a[12],
        reputation: Number(a[9]) === 0 ? null : Number(rep) / 100,
      });
    }
  }
  return { agents, count: n, isLoading: l1 || (n > 0 && l2), refetch };
}

export function useTasks() {
  const { data: count, isLoading: l1 } = useReadContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "taskCount" });
  const n = count ? Number(count) : 0;
  const { data, isLoading: l2 } = useReadContracts({
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => ({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "tasks" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: n > 0 },
  });

  const tasks: Task[] = (data ?? []).map((t, i) => {
    const x = t as readonly [
      `0x${string}`, bigint, `0x${string}`, bigint, bigint, bigint, number, boolean, string, `0x${string}`, `0x${string}`
    ];
    return {
      id: i + 1,
      client: x[0],
      agentId: Number(x[1]),
      token: x[2],
      bounty: x[3],
      deadline: Number(x[4]),
      submittedAt: Number(x[5]),
      status: Number(x[6]),
      rated: x[7],
      uri: x[8],
      resultHash: x[9],
      attestationHash: x[10],
    };
  });
  return { tasks: tasks.reverse(), count: n, isLoading: l1 || (n > 0 && l2) };
}

export type ActivityItem = {
  key: string;
  block: bigint;
  timestamp?: number;
  tx: `0x${string}`;
  kind: "escrow" | "policy" | "registry";
  gasUsed?: bigint;
  event: string;
  args: Record<string, unknown>;
};

const ALL_ABIS = [...escrowAbi, ...guardAbi, ...registryAbi];

/** All contract events since deployment, newest first. */
export function useActivity(limit = 30) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["activity", limit],
    enabled: !!client,
    refetchInterval: 20_000,
    queryFn: async (): Promise<ActivityItem[]> => {
      const logs = await client!.getLogs({
        address: [ESCROW_ADDRESS, POLICY_GUARD_ADDRESS, REGISTRY_ADDRESS],
        fromBlock: DEPLOY_BLOCK,
        toBlock: "latest",
      });
      const items: ActivityItem[] = [];
      for (const log of logs as Log[]) {
        try {
          const ev = decodeEventLog({ abi: ALL_ABIS, data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] });
          const addr = log.address.toLowerCase();
          items.push({
            key: `${log.transactionHash}-${log.logIndex}`,
            block: log.blockNumber ?? 0n,
            tx: log.transactionHash as `0x${string}`,
            kind: addr === ESCROW_ADDRESS.toLowerCase() ? "escrow" : addr === POLICY_GUARD_ADDRESS.toLowerCase() ? "policy" : "registry",
            event: ev.eventName as string,
            args: (ev.args ?? {}) as Record<string, unknown>,
          });
        } catch {
          /* unknown event */
        }
      }
      items.sort((a, b) => (a.block === b.block ? 0 : a.block < b.block ? 1 : -1));
      const top = items.slice(0, limit);
      const blocks = [...new Set(top.map((i) => i.block))];
      const stamps = new Map<bigint, number>();
      await Promise.all(
        blocks.map(async (b) => {
          try {
            stamps.set(b, Number((await client!.getBlock({ blockNumber: b })).timestamp));
          } catch {}
        })
      );
      const gas = new Map<string, bigint>();
      await Promise.all(
        [...new Set(top.slice(0, 12).map((i) => i.tx))].map(async (h) => {
          try {
            gas.set(h, (await client!.getTransactionReceipt({ hash: h })).gasUsed);
          } catch {}
        })
      );
      return top.map((i) => ({ ...i, timestamp: stamps.get(i.block), gasUsed: gas.get(i.tx) }));
    },
  });
}

export type PolicyRow = {
  account: `0x${string}`;
  target: `0x${string}`;
  limit: bigint;
  spent: bigint;
  lastReset: number;
  whitelisted: boolean;
  expiresAt: number;
};
export type SessionKeyRow = { account: `0x${string}`; key: `0x${string}`; expiresAt: number };
export type AccountRow = { address: `0x${string}`; owner: `0x${string}` };

/** Agent accounts owned by `me`, their policies and session keys (derived from Guard events + live reads). */
export function useMyPolicies(me?: `0x${string}`) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["my-policies", me],
    enabled: !!client && !!me,
    refetchInterval: 30_000,
    queryFn: async () => {
      const events = await client!.getContractEvents({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, fromBlock: DEPLOY_BLOCK, toBlock: "latest" });
      const lower = me!.toLowerCase();
      const candidates = new Set<`0x${string}`>([me!]);
      for (const e of events) {
        if (e.eventName === "AgentAccountRegistered") candidates.add((e.args as { agentAccount: `0x${string}` }).agentAccount);
      }
      const owners = await Promise.all(
        [...candidates].map(async (a) => ({
          address: a,
          owner: (await client!.readContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "agentRootOwners", args: [a] })) as `0x${string}`,
        }))
      );
      const accounts: AccountRow[] = owners.filter((o) => o.owner.toLowerCase() === lower || o.address.toLowerCase() === lower);
      const mine = new Set(accounts.map((a) => a.address.toLowerCase()));

      const pairs = new Map<string, { account: `0x${string}`; target: `0x${string}` }>();
      const keys = new Map<string, { account: `0x${string}`; key: `0x${string}` }>();
      for (const e of events) {
        const a = e.args as { agentAccount?: `0x${string}`; target?: `0x${string}`; key?: `0x${string}` };
        if (!a.agentAccount || !mine.has(a.agentAccount.toLowerCase())) continue;
        if (e.eventName === "PolicyUpdated" && a.target) pairs.set(`${a.agentAccount}-${a.target}`, { account: a.agentAccount, target: a.target });
        if (e.eventName === "SessionKeySet" && a.key) keys.set(`${a.agentAccount}-${a.key}`, { account: a.agentAccount, key: a.key });
      }

      const policies: PolicyRow[] = [];
      for (const p of pairs.values()) {
        const r = (await client!.readContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "policies", args: [p.account, p.target] })) as readonly [bigint, bigint, bigint, boolean, bigint];
        if (r[0] === 0n && !r[3] && r[2] === 0n) continue; // revoked
        policies.push({ account: p.account, target: p.target, limit: r[0], spent: r[1], lastReset: Number(r[2]), whitelisted: r[3], expiresAt: Number(r[4]) });
      }
      const sessionKeys: SessionKeyRow[] = [];
      for (const k of keys.values()) {
        const exp = Number(await client!.readContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "sessionKeys", args: [k.account, k.key] }));
        if (exp !== 0) sessionKeys.push({ ...k, expiresAt: exp });
      }
      return { accounts, policies, sessionKeys };
    },
  });
}

/** Protocol-wide numbers for the dashboard header cards. */
export function useGlobalStats() {
  const client = usePublicClient();
  const { data: totalBlocked } = useReadContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "totalBlocked" });
  const { data: activeKeys, isLoading } = useQuery({
    queryKey: ["active-session-keys"],
    enabled: !!client,
    refetchInterval: 30_000,
    queryFn: async () => {
      const events = await client!.getContractEvents({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, eventName: "SessionKeySet", fromBlock: DEPLOY_BLOCK, toBlock: "latest" });
      const uniq = new Map<string, { account: `0x${string}`; key: `0x${string}` }>();
      for (const e of events) {
        const a = e.args as { agentAccount: `0x${string}`; key: `0x${string}` };
        uniq.set(`${a.agentAccount}-${a.key}`, { account: a.agentAccount, key: a.key });
      }
      const now = Math.floor(Date.now() / 1000);
      let n = 0;
      for (const k of uniq.values()) {
        const exp = Number(await client!.readContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "sessionKeys", args: [k.account, k.key] }));
        if (exp > now) n++;
      }
      return n;
    },
  });
  return { totalBlocked: totalBlocked !== undefined ? Number(totalBlocked) : undefined, activeKeys, isLoading };
}
