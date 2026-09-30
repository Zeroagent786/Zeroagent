"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "../../hooks/useZeroAccount";
import { formatUnits, isAddress, parseUnits } from "viem";
import {
  Activity, ArrowUpRight, BadgeCheck, Ban, Bot, CheckCircle2, Clock, KeyRound, Landmark, Lock, Plus, ShieldCheck, ShieldOff, Trash2, Users,
} from "lucide-react";
import {
  Address, Badge, Button, Card, CardHeader, EmptyState, Field, MetricCard, Modal, PageHeader, Skeleton, cx, inputCls,
} from "../../components/ui";
import { useActivity, useAgents, useGlobalStats, useMyPolicies, useTasks, type ActivityItem, type PolicyRow } from "../../hooks/useChainData";
import { useTx } from "../../hooks/useTx";
import { GetStarted } from "../../components/Guide";
import {
  BLOCK_REASONS, ESCROW_ADDRESS, POLICY_GUARD_ADDRESS, REGISTRY_ADDRESS, USDC_ADDRESS, USDC_DECIMALS, ZERO_ADDRESS, guardAbi,
} from "../../lib/contracts";
import { fmtDate, relTime, timeAgo, usdc } from "../../lib/format";

const KNOWN: Record<string, string> = {
  [ESCROW_ADDRESS.toLowerCase()]: "TaskEscrow",
  [USDC_ADDRESS.toLowerCase()]: "USDC",
  [REGISTRY_ADDRESS.toLowerCase()]: "Agent Registry",
};
const label = (a: string) => KNOWN[a.toLowerCase()];
const nowS = () => Math.floor(Date.now() / 1000);

/* ---------------- Policy modals ---------------- */
function PolicyModal({
  open, onOpenChange, account, owner, preset,
}: { open: boolean; onOpenChange: (o: boolean) => void; account: `0x${string}`; owner: `0x${string}`; preset?: PolicyRow }) {
  const { address } = useAccount();
  const tx = useTx();
  const [target, setTarget] = useState<string>(preset?.target ?? ESCROW_ADDRESS);
  const [custom, setCustom] = useState("");
  const [limit, setLimit] = useState(preset ? formatUnits(preset.limit, USDC_DECIMALS) : "50");
  const [days, setDays] = useState(preset?.expiresAt ? 7 : 0);
  const [busy, setBusy] = useState(false);

  const finalTarget = target === "custom" ? custom.trim() : target;
  const valid = isAddress(finalTarget) && Number(limit) >= 0 && limit !== "";
  const unclaimed = owner === ZERO_ADDRESS;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !address) return;
    setBusy(true);
    if (unclaimed) {
      const ok = await tx("Claim agent account", { address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "registerAgent", args: [account] });
      if (!ok) return setBusy(false);
    }
    const r = await tx("Save policy", {
      address: POLICY_GUARD_ADDRESS,
      abi: guardAbi,
      functionName: "setTargetPolicy",
      args: [account, finalTarget as `0x${string}`, parseUnits(limit, USDC_DECIMALS), true, BigInt(days ? nowS() + days * 86400 : 0)],
    });
    setBusy(false);
    if (r) onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={preset ? "Edit policy" : "New delegated policy"} description="The agent can only spend on whitelisted targets, up to the daily cap.">
      <form onSubmit={save} className="space-y-4">
        <Field label="Agent account">
          <input readOnly className={cx(inputCls, "font-mono text-xs bg-subtle")} value={account} />
        </Field>
        <Field label="Whitelisted target">
          <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} disabled={!!preset}>
            <option value={ESCROW_ADDRESS}>TaskEscrow · {ESCROW_ADDRESS.slice(0, 8)}…</option>
            <option value={USDC_ADDRESS}>USDC · {USDC_ADDRESS.slice(0, 8)}…</option>
            <option value={REGISTRY_ADDRESS}>Agent Registry · {REGISTRY_ADDRESS.slice(0, 8)}…</option>
            <option value="custom">Custom address…</option>
          </select>
        </Field>
        {target === "custom" && (
          <input className={cx(inputCls, "font-mono text-xs")} placeholder="0x… (e.g. Uniswap Router)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daily limit (USDC)">
            <input type="number" min="0" step="0.000001" className={inputCls} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
          <Field label="Session expiry">
            <select className={inputCls} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={0}>Never</option>
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </Field>
        </div>
        {unclaimed && (
          <p className="text-xs text-muted rounded-lg bg-subtle p-3">
            This account isn&apos;t claimed yet. Saving will first ask you to claim it (you become root owner), then set the policy.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!valid}>{unclaimed ? "Claim & save" : "Save policy"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SessionKeyModal({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account: `0x${string}` }) {
  const tx = useTx();
  const [key, setKey] = useState("");
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Authorize session key" description="A short-lived key the agent can use to sign UserOps within your policies.">
      <div className="space-y-4">
        <Field label="Session key address">
          <input className={cx(inputCls, "font-mono text-xs")} placeholder="0x…" value={key} onChange={(e) => setKey(e.target.value.trim())} />
        </Field>
        <Field label="Valid for">
          <select className={inputCls} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={1}>1 hour</option>
            <option value={24}>24 hours</option>
            <option value={168}>7 days</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            loading={busy}
            disabled={!isAddress(key)}
            onClick={async () => {
              setBusy(true);
              const r = await tx("Authorize session key", {
                address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "setSessionKey",
                args: [account, key as `0x${string}`, BigInt(nowS() + hours * 3600)],
              });
              setBusy(false);
              if (r) { setKey(""); onOpenChange(false); }
            }}
          >
            Authorize
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Delegated policies ---------------- */
function PolicyCard({ p, onEdit }: { p: PolicyRow; onEdit: () => void }) {
  const tx = useTx();
  const [busy, setBusy] = useState(false);
  const expired = p.expiresAt !== 0 && nowS() > p.expiresAt;
  const windowOver = nowS() >= p.lastReset + 86400;
  const spent = windowOver ? 0n : p.spent;
  const pct = p.limit === 0n ? 0 : Math.min(100, Number((spent * 100n) / p.limit));
  const name = label(p.target);
  return (
    <div className="rounded-xl border border-line p-4 hover:border-line-active transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{name ?? "Custom target"}</span>
            {p.whitelisted && !expired ? <Badge tone="teal" dot>Whitelisted</Badge> : <Badge tone="red">{expired ? "Expired" : "Blocked"}</Badge>}
          </div>
          <Address value={p.target} className="text-muted mt-1" />
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Revoke policy"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await tx("Revoke policy", { address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "revokePolicy", args: [p.account, p.target] });
              setBusy(false);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted">Spent (rolling 24h)</span>
          <span className="tabular-nums font-medium">{usdc(spent)} / {usdc(p.limit)} USDC</span>
        </div>
        <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
          <div className={cx("h-full rounded-full transition-all", pct > 85 ? "bg-amber" : "bg-teal")} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted flex items-center gap-1.5">
        <Clock className="h-3 w-3" /> {p.expiresAt === 0 ? "No expiry" : `Expires ${fmtDate(p.expiresAt)} (${relTime(p.expiresAt)})`}
      </p>
    </div>
  );
}

function MyPolicies() {
  const { address, isConnected } = useAccount();
  const { data, isLoading } = useMyPolicies(address);
  const [policyFor, setPolicyFor] = useState<{ account: `0x${string}`; owner: `0x${string}`; preset?: PolicyRow } | null>(null);
  const [keyFor, setKeyFor] = useState<`0x${string}` | null>(null);
  const tx = useTx();

  const accounts = (data?.accounts ?? []).filter((a) => a.owner !== ZERO_ADDRESS);
  const primary = data?.accounts.find((a) => a.address.toLowerCase() === address?.toLowerCase());
  const hasAny = (data?.policies.length ?? 0) > 0 || (data?.sessionKeys.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader
        title="My delegated policies"
        subtitle="ERC-7579 spend limits, target whitelists and session expiry for your agents."
        action={
          isConnected && (
            <Button size="sm" onClick={() => setPolicyFor({ account: address!, owner: primary?.owner ?? ZERO_ADDRESS })}>
              <Plus className="h-3.5 w-3.5" /> New policy
            </Button>
          )
        }
      />
      <div className="p-5 space-y-6">
        {!isConnected ? (
          <EmptyState icon={<Lock className="h-5 w-5" />} title="Connect your wallet" body="Your smart-account policies and session keys appear here once you connect." />
        ) : isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="rounded-xl bg-subtle/60 border border-line p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Smart account</p>
                <Address value={address!} className="text-sm mt-0.5" />
              </div>
              {primary && primary.owner !== ZERO_ADDRESS ? <Badge tone="teal" dot>Claimed · you are root owner</Badge> : <Badge tone="neutral">Not claimed yet</Badge>}
            </div>

            {!hasAny && (
              <EmptyState
                icon={<ShieldOff className="h-5 w-5" />}
                title="No active policies"
                body="Create your first policy to give an agent bounded, short-lived spending power."
                action={
                  <Button onClick={() => setPolicyFor({ account: address!, owner: primary?.owner ?? ZERO_ADDRESS })}>
                    <Plus className="h-4 w-4" /> Create your first policy
                  </Button>
                }
              />
            )}

            {accounts.map((acc) => {
              const pols = data!.policies.filter((p) => p.account === acc.address);
              const keys = data!.sessionKeys.filter((k) => k.account === acc.address);
              if (pols.length === 0 && keys.length === 0) return null;
              return (
                <div key={acc.address} className="space-y-3">
                  {accounts.length > 1 && (
                    <div className="flex items-center gap-2 text-xs text-muted">Account <Address value={acc.address} /></div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {pols.map((p) => (
                      <PolicyCard key={p.target} p={p} onEdit={() => setPolicyFor({ account: acc.address, owner: acc.owner, preset: p })} />
                    ))}
                  </div>
                  {keys.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Session keys</h4>
                      <ul className="divide-y divide-line rounded-xl border border-line">
                        {keys.map((k) => {
                          const live = k.expiresAt > nowS();
                          return (
                            <li key={k.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                              <span className="flex items-center gap-2"><KeyRound className="h-3.5 w-3.5 text-muted" /><Address value={k.key} /></span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-muted">{live ? `expires ${relTime(k.expiresAt)}` : "expired"}</span>
                                <Badge tone={live ? "teal" : "neutral"}>{live ? "Active" : "Expired"}</Badge>
                                {live && (
                                  <Button size="sm" variant="ghost" onClick={() => tx("Revoke session key", { address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "setSessionKey", args: [k.account, k.key, 0n] })}>
                                    Revoke
                                  </Button>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setKeyFor(acc.address)}><KeyRound className="h-3.5 w-3.5" /> Add session key</Button>
                </div>
              );
            })}

            <p className="border-t border-line pt-4 text-xs text-muted">
              Policies protect the wallet you are connected with. To protect an agent&apos;s own wallet, connect that wallet and create the policy there; you can then hand root ownership to your main wallet.
            </p>
          </>
        )}
      </div>

      {policyFor && (
        <PolicyModal key={`${policyFor.account}${policyFor.preset?.target}`} open onOpenChange={(o) => !o && setPolicyFor(null)} account={policyFor.account} owner={policyFor.owner} preset={policyFor.preset} />
      )}
      {keyFor && <SessionKeyModal open onOpenChange={(o) => !o && setKeyFor(null)} account={keyFor} />}
    </Card>
  );
}

/* ---------------- Live activity ---------------- */
function describe(i: ActivityItem): { icon: React.ReactNode; title: string; target: string; badge: React.ReactNode } {
  const a = i.args as Record<string, bigint | string | boolean>;
  const ok = <Badge tone="teal" dot>Confirmed</Badge>;
  switch (i.event) {
    case "TaskCreated": return { icon: <Landmark className="h-4 w-4" />, title: `Task #${a.taskId} created · ${usdc(a.bounty as bigint)} USDC locked`, target: "TaskEscrow", badge: ok };
    case "TaskAssigned": return { icon: <Bot className="h-4 w-4" />, title: `Agent #${a.agentId} assigned to task #${a.taskId}`, target: "TaskEscrow", badge: ok };
    case "ResultSubmitted": return { icon: <ShieldCheck className="h-4 w-4" />, title: `Task #${a.taskId} result submitted by agent #${a.agentId}`, target: "TaskEscrow", badge: <Badge tone="teal" dot>Attested</Badge> };
    case "FundsReleased": return { icon: <CheckCircle2 className="h-4 w-4" />, title: `${usdc(a.amount as bigint)} USDC released for task #${a.taskId}`, target: "TaskEscrow", badge: <Badge tone="teal">Settled</Badge> };
    case "TaskDisputed": return { icon: <Ban className="h-4 w-4" />, title: `Task #${a.taskId} disputed`, target: "TaskEscrow", badge: <Badge tone="red" dot>Challenged</Badge> };
    case "TaskRefunded": return { icon: <Landmark className="h-4 w-4" />, title: `Task #${a.taskId} refunded`, target: "TaskEscrow", badge: <Badge tone="neutral">Refunded</Badge> };
    case "AgentRegistered": return { icon: <BadgeCheck className="h-4 w-4" />, title: `Agent “${a.name}” registered as #${a.agentId}`, target: "Registry", badge: ok };
    case "MemoryRootCommitted": return { icon: <Activity className="h-4 w-4" />, title: `Memory root committed for agent #${a.agentId}`, target: "Registry", badge: ok };
    case "PolicyUpdated": return { icon: <ShieldCheck className="h-4 w-4" />, title: `Policy set · limit ${usdc(a.dailyLimit as bigint)} USDC/day`, target: "PolicyGuard", badge: ok };
    case "PolicyTriggered": return { icon: <ShieldCheck className="h-4 w-4" />, title: `Spend of ${usdc(a.amount as bigint)} USDC approved`, target: "PolicyGuard", badge: ok };
    case "SpendBlocked": return { icon: <Ban className="h-4 w-4" />, title: `Spend blocked: ${BLOCK_REASONS[Number(a.reason)]}`, target: "PolicyGuard", badge: <Badge tone="red" dot>Blocked</Badge> };
    case "SessionKeySet": return { icon: <KeyRound className="h-4 w-4" />, title: "Session key updated", target: "PolicyGuard", badge: ok };
    case "PolicyRevoked": return { icon: <ShieldOff className="h-4 w-4" />, title: "Policy revoked", target: "PolicyGuard", badge: <Badge tone="neutral">Revoked</Badge> };
    case "AgentAccountRegistered": return { icon: <ShieldCheck className="h-4 w-4" />, title: "Agent account claimed", target: "PolicyGuard", badge: ok };
    default: return { icon: <Activity className="h-4 w-4" />, title: i.event, target: i.kind, badge: ok };
  }
}

function LiveActivity() {
  const { data, isLoading } = useActivity(12);
  return (
    <Card>
      <CardHeader
        title="Live transaction activity"
        subtitle="On-chain events from the registry, escrow and policy guard."
        action={<span className="flex items-center gap-1.5 text-xs text-muted"><span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" /> Live</span>}
      />
      {isLoading ? (
        <div className="p-5 space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !data || data.length === 0 ? (
        <EmptyState icon={<Activity className="h-5 w-5" />} title="No activity yet" body="Register an agent or post a task and it will stream in here." />
      ) : (
        <ul className="divide-y divide-line">
          {data.map((i) => {
            const d = describe(i);
            return (
              <li key={i.key} className="flex items-center gap-4 px-5 py-3 hover:bg-subtle/40 transition-colors">
                <span className="h-8 w-8 shrink-0 rounded-lg bg-subtle border border-line flex items-center justify-center text-muted">{d.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{d.title}</p>
                  <p className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-x-3">
                    <span>{d.target}</span>
                    <Address value={i.tx} type="tx" className="text-muted" />
                    {i.gasUsed !== undefined && <span className="tabular-nums">{Number(i.gasUsed).toLocaleString()} gas</span>}
                    {i.timestamp && <span>{timeAgo(i.timestamp)}</span>}
                  </p>
                </div>
                <div className="hidden sm:block">{d.badge}</div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Page ---------------- */
export default function DashboardPage() {
  const { tasks, isLoading: tl } = useTasks();
  const { agents, isLoading: al } = useAgents();
  const stats = useGlobalStats();

  const inFlight = tasks.filter((t) => [0, 1, 2, 4].includes(t.status));
  const locked = inFlight.reduce((s, t) => s + t.bounty, 0n);
  const leases = new Set(tasks.filter((t) => t.status === 1 || t.status === 2).map((t) => t.agentId)).size;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Your operational control room for delegated agent authority."
        action={<Link href="/app/agents" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">Browse agents <ArrowUpRight className="h-4 w-4" /></Link>}
      />

      <GetStarted />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<KeyRound className="h-4 w-4" />} label="Active session keys" value={stats.activeKeys ?? 0} loading={stats.isLoading} hint="delegating authority to agents" />
        <MetricCard
          icon={<Landmark className="h-4 w-4" />}
          label="Escrow locked"
          value={<>{usdc(locked)}<span className="text-base text-muted font-medium"> USDC</span></>}
          loading={tl}
          hint={`${inFlight.length} task${inFlight.length === 1 ? "" : "s"} in flight`}
        />
        <MetricCard icon={<Ban className="h-4 w-4" />} label="Reversions blocked" value={stats.totalBlocked ?? 0} loading={stats.totalBlocked === undefined} hint="out-of-policy spends stopped" />
        <MetricCard icon={<Users className="h-4 w-4" />} label="Active agent leases" value={leases} loading={tl || al} hint={`of ${agents.length} registered agents`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div id="policies" className="xl:col-span-3 scroll-mt-24"><MyPolicies /></div>
        <div className="xl:col-span-2"><LiveActivity /></div>
      </div>
    </div>
  );
}
