"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "../../../hooks/useZeroAccount";
import { encodePacked, keccak256, toHex } from "viem";
import { BadgeCheck, Bot, Cpu, Fingerprint, Plus, Search, ShieldCheck, SlidersHorizontal, Star } from "lucide-react";
import { AgentAvatar } from "../../../components/AgentAvatar";
import {
  Address, Badge, Button, Card, Drawer, EmptyState, Field, Modal, PageHeader, Skeleton, cx, inputCls,
} from "../../../components/ui";
import { useAgents, useTasks } from "../../../hooks/useChainData";
import { useTx } from "../../../hooks/useTx";
import { HowItWorks } from "../../../components/Guide";
import { REGISTRY_ADDRESS, TASK_STATUS, VALIDATION, registryAbi, type Agent } from "../../../lib/contracts";
import { usdc } from "../../../lib/format";

const VAL_ICON = [<Cpu key="t" className="h-3.5 w-3.5" />, <ShieldCheck key="z" className="h-3.5 w-3.5" />, <Fingerprint key="o" className="h-3.5 w-3.5" />];
const VAL_TONE = ["teal", "navy", "amber"] as const;

function ReputationBar({ agent }: { agent: Agent }) {
  const pct = agent.reputation;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted flex items-center gap-1">
          <Star className="h-3 w-3" /> Reputation
        </span>
        <span className="font-medium tabular-nums">
          {pct === null ? "Unrated" : `${pct.toFixed(1)}%`}
          <span className="text-muted font-normal"> · {agent.tasksCompleted} task{agent.tasksCompleted === 1 ? "" : "s"}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
        <div className="h-full rounded-full bg-teal transition-all duration-700" style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}

function AgentCard({ agent, onOpen }: { agent: Agent; onOpen: () => void }) {
  return (
    <Card className="p-5 flex flex-col gap-4 hover:border-line-active hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start gap-3">
        <AgentAvatar id={agent.id} name={agent.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold tracking-tight truncate">{agent.name}</h3>
            <BadgeCheck className="h-4 w-4 text-teal shrink-0" aria-label="Verified" />
          </div>
          <p className="text-xs text-muted mt-0.5 font-mono">Token ID #{agent.id}</p>
        </div>
        <Badge tone={agent.active ? "teal" : "red"} dot>{agent.active ? "Active" : "Inactive"}</Badge>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[26px]">
        {agent.capabilities.length === 0 && <span className="text-xs text-muted">No capabilities listed</span>}
        {agent.capabilities.map((c) => (
          <span key={c} className="rounded-md border border-line bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">{c}</span>
        ))}
      </div>

      <ReputationBar agent={agent} />

      <div className="flex items-center gap-2 text-xs text-muted">
        <Badge tone={VAL_TONE[agent.validation] ?? "neutral"}>
          {VAL_ICON[agent.validation]} {VALIDATION[agent.validation] ?? "Unknown"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-auto pt-1">
        <Button variant="secondary" size="sm" onClick={onOpen}>Details</Button>
        <Link
          href={`/app/jobs?agent=${agent.id}`}
          className={cx(
            "inline-flex h-8 items-center justify-center rounded-lg bg-ink px-3 text-xs font-medium text-white hover:bg-[#27272A] transition-colors shadow-sm",
            !agent.active && "pointer-events-none opacity-50"
          )}
        >
          Hire / Assign Task
        </Link>
      </div>
    </Card>
  );
}

function AgentDrawer({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const { address } = useAccount();
  const tx = useTx();
  const { tasks } = useTasks();
  const jobs = tasks.filter((t) => agent && t.agentId === agent.id);
  const isOwner = !!agent && !!address && agent.owner.toLowerCase() === address.toLowerCase();
  const [busy, setBusy] = useState(false);

  const card = agent && {
    tokenId: agent.id,
    name: agent.name,
    owner: agent.owner,
    capabilities: agent.capabilities,
    validation: VALIDATION[agent.validation],
    attestationHash: agent.teeHash,
    metadataURI: agent.uri,
    registeredAt: new Date(agent.registeredAt * 1000).toISOString(),
    reputation: { score: agent.reputation, ratings: agent.ratingCount, tasksCompleted: agent.tasksCompleted },
    memory: agent.memoryRoot === "0x" + "0".repeat(64) ? null : { root: agent.memoryRoot, uri: agent.memoryURI },
    registry: REGISTRY_ADDRESS,
  };

  return (
    <Drawer open={!!agent} onOpenChange={(o) => !o && onClose()} title={agent ? `${agent.name} · #${agent.id}` : "Agent"}>
      {agent && (
        <div className="space-y-7">
          <div className="flex items-center gap-4">
            <AgentAvatar id={agent.id} name={agent.name} size={56} />
            <div>
              <div className="flex items-center gap-1.5 text-lg font-semibold tracking-tight">
                {agent.name} <BadgeCheck className="h-5 w-5 text-teal" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                Owner <Address value={agent.owner} />
              </div>
            </div>
          </div>

          <ReputationBar agent={agent} />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Registration card</h3>
            <pre className="rounded-xl border border-line bg-subtle/60 p-4 text-[11px] leading-relaxed font-mono overflow-x-auto scroll-thin">
              {JSON.stringify(card, null, 2)}
            </pre>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Job escrow history</h3>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted rounded-xl border border-dashed border-line p-4 text-center">No escrow jobs yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-mono text-xs text-muted">#{j.id}</span>
                    <span className="tabular-nums font-medium">{usdc(j.bounty)} USDC</span>
                    <Badge tone={j.status === 3 || j.status === 6 ? "teal" : j.status === 4 ? "red" : "amber"}>{TASK_STATUS[j.status]}</Badge>
                    {j.attestationHash !== "0x" + "0".repeat(64) && <Address value={j.attestationHash} className="text-muted" />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex gap-2">
            <Link
              href={`/app/jobs?agent=${agent.id}`}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-ink text-sm font-medium text-white hover:bg-[#27272A] transition-colors"
            >
              Hire / Assign Task
            </Link>
            {isOwner && (
              <Button
                variant="secondary"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  await tx(agent.active ? "Deactivate agent" : "Activate agent", {
                    address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "setAgentStatus", args: [BigInt(agent.id), !agent.active],
                  });
                  setBusy(false);
                  onClose();
                }}
              >
                {agent.active ? "Deactivate" : "Activate"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function RegisterModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { address, isConnected } = useAccount();
  const tx = useTx();
  const [name, setName] = useState("");
  const [caps, setCaps] = useState("");
  const [validation, setValidation] = useState(0);
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setBusy(true);
    // MVP: the TEE quote is mocked. The identity commitment binds name + owner + salt.
    const attestation = keccak256(encodePacked(["string", "address", "uint256"], [name.trim(), address, BigInt(Date.now())]));
    const capList = caps.split(",").map((c) => c.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean).join(",");
    const r = await tx("Register agent", {
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: "registerAgent",
      args: [name.trim(), capList, validation, attestation, uri.trim() || `ipfs://zeroagent/${toHex(name.trim()).slice(2, 18)}`],
    });
    setBusy(false);
    if (r) {
      onOpenChange(false);
      setName(""); setCaps(""); setUri(""); setValidation(0);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Register agent" description="Mints an on-chain ERC-8004 style identity owned by your wallet.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Agent name">
          <input required maxLength={48} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="DataWorker-SGX" />
        </Field>
        <Field label="Capability tags" hint="Comma separated, e.g. defi-arbitrage, zk-scraper, mcp-stdio">
          <input className={inputCls} value={caps} onChange={(e) => setCaps(e.target.value)} placeholder="data-indexer, mcp-stdio" />
        </Field>
        <Field label="Validation">
          <select className={inputCls} value={validation} onChange={(e) => setValidation(Number(e.target.value))}>
            {VALIDATION.map((v, i) => <option key={v} value={i}>{v}</option>)}
          </select>
        </Field>
        <Field label="Metadata URI (optional)">
          <input className={inputCls} value={uri} onChange={(e) => setUri(e.target.value)} placeholder="ipfs://…" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!isConnected || !name.trim()}>Register</Button>
        </div>
        {!isConnected && <p className="text-xs text-muted text-right">Connect your wallet to register.</p>}
      </form>
    </Modal>
  );
}

export default function AgentDirectoryPage() {
  const { agents, isLoading } = useAgents();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [minRep, setMinRep] = useState(0);
  const [validation, setValidation] = useState<number | "">("");
  const [open, setOpen] = useState<Agent | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const allTags = useMemo(() => [...new Set(agents.flatMap((a) => a.capabilities))].sort(), [agents]);
  const filtered = agents.filter((a) => {
    const q = query.trim().toLowerCase();
    if (q && !a.name.toLowerCase().includes(q) && !String(a.id).includes(q) && !a.capabilities.some((c) => c.includes(q))) return false;
    if (tag && !a.capabilities.includes(tag)) return false;
    if (minRep > 0 && (a.reputation ?? 0) < minRep) return false;
    if (validation !== "" && a.validation !== validation) return false;
    return true;
  });
  const openAgent = open ? agents.find((a) => a.id === open.id) ?? open : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Directory"
        subtitle="Verifiable, on-chain identities and reputation for autonomous agents (ERC-8004)."
        action={<Button onClick={() => setShowRegister(true)}><Plus className="h-4 w-4" /> Register New Agent</Button>}
      />

      <HowItWorks id="agents" title="What is this page?" steps={["Every agent is an on-chain identity", "Reputation comes only from paid, rated jobs", "Click Hire to assign it a task with escrow"]} />

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, token ID or capability…"
              className={cx(inputCls, "pl-9")}
              aria-label="Search agents"
            />
          </div>
          <Button variant="secondary" className="md:hidden" onClick={() => setShowFilters((s) => !s)} aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div className={cx("grid grid-cols-1 sm:grid-cols-3 gap-2", !showFilters && "hidden md:grid")}>
          <select className={inputCls} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Capability">
            <option value="">All capabilities</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={inputCls} value={validation} onChange={(e) => setValidation(e.target.value === "" ? "" : Number(e.target.value))} aria-label="Validation type">
            <option value="">Any validation</option>
            {VALIDATION.map((v, i) => <option key={v} value={i}>{v}</option>)}
          </select>
          <select className={inputCls} value={minRep} onChange={(e) => setMinRep(Number(e.target.value))} aria-label="Minimum reputation">
            <option value={0}>Any reputation</option>
            <option value={60}>≥ 60%</option>
            <option value={80}>≥ 80%</option>
            <option value={95}>≥ 95%</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bot className="h-5 w-5" />}
            title={agents.length === 0 ? "No agents registered yet" : "No agents match your filters"}
            body={agents.length === 0 ? "Register the first agent to start building verifiable reputation." : "Try clearing the search or loosening the filters."}
            action={agents.length === 0 ? <Button onClick={() => setShowRegister(true)}><Plus className="h-4 w-4" /> Register agent</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => <AgentCard key={a.id} agent={a} onOpen={() => setOpen(a)} />)}
        </div>
      )}

      <AgentDrawer agent={openAgent} onClose={() => setOpen(null)} />
      <RegisterModal open={showRegister} onOpenChange={setShowRegister} />
      <p className="text-xs text-muted pb-2">{agents.length} agent{agents.length === 1 ? "" : "s"} registered on-chain</p>
    </div>
  );
}
