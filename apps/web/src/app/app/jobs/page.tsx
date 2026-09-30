"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePublicClient, useReadContract } from "wagmi";
import { useAccount, useZeroAccount } from "../../../hooks/useZeroAccount";
import { formatUnits, keccak256, parseUnits, toHex, type Hex } from "viem";
import { Briefcase, Check, Clock, Plus, ShieldCheck, Star } from "lucide-react";
import {
  Address, Badge, Button, Card, Drawer, EmptyState, Field, Modal, PageHeader, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, cx, inputCls,
} from "../../../components/ui";
import { useAgents, useTasks } from "../../../hooks/useChainData";
import { useTx } from "../../../hooks/useTx";
import { HowItWorks } from "../../../components/Guide";
import {
  ESCROW_ADDRESS, USDC_ADDRESS, USDC_DECIMALS, erc20Abi, escrowAbi,
  receiveWithAuthorizationTypes, usdcDomain, type Agent, type Task,
} from "../../../lib/contracts";
import { fmtDate, relTime, usdc } from "../../../lib/format";
import { decodeTask, encodeTask } from "../../../lib/task";

const REVIEW_WINDOW = 3 * 24 * 3600;
const ZERO_HASH = ("0x" + "0".repeat(64)) as Hex;
const now = () => Math.floor(Date.now() / 1000);

function statusBadge(t: Task) {
  switch (t.status) {
    case 0: return <Badge tone="neutral" dot>Open · unassigned</Badge>;
    case 1: return <Badge tone="amber" dot>Pending enclave execution</Badge>;
    case 2: return <Badge tone="teal" dot>Attested</Badge>;
    case 3: return <Badge tone="teal">Completed</Badge>;
    case 4: return <Badge tone="red" dot>Challenged</Badge>;
    case 5: return <Badge tone="neutral">Refunded</Badge>;
    default: return <Badge tone="navy">Resolved</Badge>;
  }
}

/* ---------------- Escrow flow stepper ---------------- */
function Stepper({ task }: { task: Task }) {
  const steps = ["Locked", "Assigned", "Submitted", "Released"];
  const at = task.status === 0 ? 0 : task.status === 1 ? 1 : task.status === 2 || task.status === 4 ? 2 : task.status === 3 || task.status === 6 ? 3 : -1;
  if (task.status === 5) return <Badge tone="neutral">Escrow refunded to client</Badge>;
  return (
    <ol className="flex items-center">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                i <= at ? "bg-teal border-teal text-white" : "bg-surface border-line text-muted",
                task.status === 4 && i === 2 && "bg-danger border-danger"
              )}
            >
              {i <= at ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cx("text-[10px] font-medium", i <= at ? "text-ink" : "text-muted")}>{s}</span>
          </div>
          {i < steps.length - 1 && <span className={cx("mx-2 mb-4 h-px flex-1", i < at ? "bg-teal" : "bg-line")} />}
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Modals ---------------- */
function CreateTaskModal({
  open, onOpenChange, agents, presetAgent,
}: { open: boolean; onOpenChange: (o: boolean) => void; agents: Agent[]; presetAgent: string }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { account: signer } = useZeroAccount();
  const tx = useTx();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState(presetAgent);
  const [amount, setAmount] = useState("");
  const [deadlineHrs, setDeadlineHrs] = useState(24);
  const [verifyTee, setVerifyTee] = useState(true);
  const [verifyZk, setVerifyZk] = useState(false);
  const [permit, setPermit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address },
  });

  const activeAgents = agents.filter((a) => a.active);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !publicClient) return;
    setError(null);
    let bounty: bigint;
    try {
      bounty = parseUnits(amount, USDC_DECIMALS);
    } catch {
      return setError("Enter a valid USDC amount");
    }
    if (bounty <= 0n) return setError("Amount must be greater than zero");
    if (balance !== undefined && bounty > balance) return setError(`Insufficient USDC — you have ${formatUnits(balance, USDC_DECIMALS)}.`);

    setBusy(true);
    const uri = encodeTask({ title: title.trim(), description: description.trim(), verify: [verifyTee && "tee", verifyZk && "zktls"].filter(Boolean) as string[] });
    const deadline = BigInt(now() + deadlineHrs * 3600);
    const aid = agentId ? BigInt(agentId) : 0n;

    try {
      let receipt;
      if (permit) {
        // EIP-3009: one signature funds the escrow, no approve transaction.
        const nonce = keccak256(toHex(crypto.getRandomValues(new Uint8Array(32))));
        const validBefore = BigInt(now() + 3600);
        if (!signer) throw new Error("Connect your wallet first");
        const signature = await signer.signTypedData({
          domain: usdcDomain,
          types: receiveWithAuthorizationTypes,
          primaryType: "ReceiveWithAuthorization",
          message: { from: address, to: ESCROW_ADDRESS, value: bounty, validAfter: 0n, validBefore, nonce },
        });
        const r = `0x${signature.slice(2, 66)}` as Hex;
        const s = `0x${signature.slice(66, 130)}` as Hex;
        const v = parseInt(signature.slice(130, 132), 16);
        receipt = await tx("Create task (gasless USDC deposit)", {
          address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "createTaskWithAuthorization",
          args: [USDC_ADDRESS, bounty, deadline, uri, aid, 0n, validBefore, nonce, v, r, s],
        });
      } else {
        const allowance = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [address, ESCROW_ADDRESS] });
        if (allowance < bounty) {
          const ok = await tx("Approve USDC", { address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [ESCROW_ADDRESS, bounty] });
          if (!ok) return setBusy(false);
        }
        receipt = await tx("Create task", {
          address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "createTask", args: [USDC_ADDRESS, bounty, deadline, uri, aid],
        });
      }
      if (receipt) {
        onOpenChange(false);
        setTitle(""); setDescription(""); setAmount(""); setAgentId("");
      }
    } catch (err) {
      const m = (err as { shortMessage?: string }).shortMessage ?? (err as Error).message;
      setError(/rejected|denied/i.test(m) ? "Signature request was rejected." : m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Post new task" description="Lock USDC in escrow. Funds only move when you verify the agent's attested result." wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Task title">
          <input required maxLength={80} className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fetch DEX prices (Uniswap v3)" />
        </Field>
        <Field label="Task description">
          <textarea required rows={3} className={cx(inputCls, "h-auto py-2 resize-none")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What exactly should the agent deliver?" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Target agent">
            <select className={inputCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Open (assign later)</option>
              {activeAgents.map((a) => <option key={a.id} value={a.id}>#{a.id} · {a.name}</option>)}
            </select>
          </Field>
          <Field label="Escrow amount (USDC)" hint={balance !== undefined ? <>Balance: {usdc(balance)} USDC</> : undefined}>
            <input required type="number" min="0.000001" step="0.000001" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" />
          </Field>
          <Field label="Expiration deadline">
            <select className={inputCls} value={deadlineHrs} onChange={(e) => setDeadlineHrs(Number(e.target.value))}>
              <option value={1}>1 hour</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
          </Field>
          <div>
            <span className="block text-xs font-medium mb-1.5">Verification criteria</span>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verifyTee} onChange={(e) => setVerifyTee(e.target.checked)} /> Require TEE attestation</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verifyZk} onChange={(e) => setVerifyZk(e.target.checked)} /> Require zkTLS proof</label>
            </div>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-line bg-subtle/50 p-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1" checked={permit} onChange={(e) => setPermit(e.target.checked)} />
          <span>
            <span className="font-medium">Fund with EIP-3009 signature</span>
            <span className="block text-xs text-muted mt-0.5">One gasless signature locks the USDC — no separate approval transaction.</span>
          </span>
        </label>
        {error && <p className="text-sm text-danger rounded-lg bg-red-50 border border-red-200 px-3 py-2 break-words">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!isConnected}>Lock funds & create</Button>
        </div>
        {!isConnected && <p className="text-xs text-muted text-right">Connect your wallet to post a task.</p>}
      </form>
    </Modal>
  );
}

function SubmitProofModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const tx = useTx();
  const [result, setResult] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);

  const gen = () => setQuote(toHex(crypto.getRandomValues(new Uint8Array(48))));
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setBusy(true);
    const r = await tx("Submit attested result", {
      address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "submitResult",
      args: [BigInt(task.id), keccak256(toHex(result.trim())), keccak256(quote.trim().startsWith("0x") ? (quote.trim() as Hex) : toHex(quote.trim()))],
    });
    setBusy(false);
    if (r) { setResult(""); setQuote(""); onClose(); }
  };

  return (
    <Modal open={!!task} onOpenChange={(o) => !o && onClose()} title={`Submit proof · Task #${task?.id ?? ""}`} description="Only hashes go on-chain: keccak256 of your output and of the enclave attestation quote.">
      <form onSubmit={go} className="space-y-4">
        <Field label="Task output">
          <textarea required rows={3} className={cx(inputCls, "h-auto py-2 resize-none font-mono text-xs")} value={result} onChange={(e) => setResult(e.target.value)} placeholder='{"pair":"ETH/USDC","price":"3421.55"}' />
        </Field>
        <Field label="TEE attestation quote (hex)" hint={<button type="button" className="underline" onClick={gen}>Generate mock quote (MVP: TEE is simulated)</button>}>
          <input required className={cx(inputCls, "font-mono text-xs")} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="0x…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy}>Submit result</Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({ task, agents, onClose }: { task: Task | null; agents: Agent[]; onClose: () => void }) {
  const tx = useTx();
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!task} onOpenChange={(o) => !o && onClose()} title={`Assign agent · Task #${task?.id ?? ""}`}>
      <div className="space-y-4">
        <Field label="Agent">
          <select className={inputCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Select an active agent…</option>
            {agents.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>#{a.id} · {a.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            loading={busy}
            disabled={!agentId}
            onClick={async () => {
              if (!task) return;
              setBusy(true);
              const r = await tx("Assign agent", { address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "assignAgent", args: [BigInt(task.id), BigInt(agentId)] });
              setBusy(false);
              if (r) onClose();
            }}
          >
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RateModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const tx = useTx();
  const [score, setScore] = useState(5);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!task} onOpenChange={(o) => !o && onClose()} title={`Rate agent · Task #${task?.id ?? ""}`} description="Your rating is written to the agent's on-chain reputation.">
      <div className="space-y-5">
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setScore(n)} aria-label={`${n} star`} className="p-1">
              <Star className={cx("h-8 w-8 transition-colors", n <= score ? "fill-amber text-amber" : "text-line-active")} />
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            loading={busy}
            onClick={async () => {
              if (!task) return;
              setBusy(true);
              const r = await tx("Rate agent", { address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "rateAgent", args: [BigInt(task.id), score] });
              setBusy(false);
              if (r) onClose();
            }}
          >
            Submit rating
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Actions ---------------- */
type Modals = { assign: (t: Task) => void; proof: (t: Task) => void; rate: (t: Task) => void };

function TaskActions({ task, me, agents, modals, size = "sm" }: { task: Task; me?: string; agents: Agent[]; modals: Modals; size?: "sm" | "md" }) {
  const tx = useTx();
  const [busy, setBusy] = useState<string | null>(null);
  const isClient = !!me && task.client.toLowerCase() === me.toLowerCase();
  const agent = agents.find((a) => a.id === task.agentId);
  const isWorker = !!me && !!agent && agent.owner.toLowerCase() === me.toLowerCase();
  const expired = now() > task.deadline;
  const reviewOpen = now() < task.submittedAt + REVIEW_WINDOW;

  const call = async (key: string, label: string, fn: "releaseFunds" | "disputeTask" | "claimExpired" | "claimBounty" | "resolveStaleDispute") => {
    setBusy(key);
    await tx(label, { address: ESCROW_ADDRESS, abi: escrowAbi, functionName: fn, args: [BigInt(task.id)] });
    setBusy(null);
  };

  const btns: React.ReactNode[] = [];
  if (isClient && task.status === 0) btns.push(<Button key="as" size={size} onClick={() => modals.assign(task)}>Assign agent</Button>);
  if (isClient && (task.status === 0 || task.status === 1) && expired)
    btns.push(<Button key="rf" size={size} variant="secondary" loading={busy === "rf"} onClick={() => call("rf", "Refund escrow", "claimExpired")}>Refund</Button>);
  if (isWorker && task.status === 1 && !expired) btns.push(<Button key="sp" size={size} onClick={() => modals.proof(task)}>Submit proof</Button>);
  if (isClient && task.status === 2) {
    btns.push(<Button key="rel" size={size} loading={busy === "rel"} onClick={() => call("rel", "Verify & release funds", "releaseFunds")}>Verify & Release</Button>);
    if (reviewOpen) btns.push(<Button key="dis" size={size} variant="danger" loading={busy === "dis"} onClick={() => call("dis", "Dispute task", "disputeTask")}>Dispute</Button>);
  }
  if (isWorker && task.status === 2 && !reviewOpen)
    btns.push(<Button key="cb" size={size} loading={busy === "cb"} onClick={() => call("cb", "Claim bounty", "claimBounty")}>Claim Bounty</Button>);
  if (isClient && task.status === 3 && !task.rated) btns.push(<Button key="rt" size={size} variant="secondary" onClick={() => modals.rate(task)}><Star className="h-3.5 w-3.5" /> Rate</Button>);

  if (task.status === 4 && (isClient || isWorker) && now() >= task.submittedAt + REVIEW_WINDOW + 14 * 24 * 3600)
    btns.push(<Button key="sd" size={size} variant="secondary" loading={busy === "sd"} onClick={() => call("sd", "Settle stale dispute (50/50)", "resolveStaleDispute")}>Settle 50/50</Button>);
  if (btns.length === 0) return <span className="text-xs text-muted">{task.status === 4 ? "Awaiting arbiter" : "—"}</span>;
  return <div className="flex flex-wrap justify-end gap-2">{btns}</div>;
}

/* ---------------- Table ---------------- */
function TaskTable({
  tasks, agents, me, modals, onOpen, empty,
}: { tasks: Task[]; agents: Agent[]; me?: string; modals: Modals; onOpen: (t: Task) => void; empty: React.ReactNode }) {
  if (tasks.length === 0) return <Card className="mt-6">{empty}</Card>;
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle/60 text-left text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-5 py-3">Task</th>
              <th className="px-5 py-3">Worker</th>
              <th className="px-5 py-3 text-right">Bounty</th>
              <th className="px-5 py-3">Proof status</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tasks.map((t) => {
              const meta = decodeTask(t.uri);
              const agent = agents.find((a) => a.id === t.agentId);
              return (
                <tr key={t.id} className="hover:bg-subtle/40 transition-colors">
                  <td className="px-5 py-4">
                    <button onClick={() => onOpen(t)} className="text-left group">
                      <div className="font-medium group-hover:underline">{meta.title}</div>
                      <div className="text-xs text-muted font-mono mt-0.5 flex items-center gap-2">
                        #{t.id}
                        <span className="inline-flex items-center gap-1 font-sans"><Clock className="h-3 w-3" />{now() > t.deadline ? "expired " : "due "}{relTime(t.deadline)}</span>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    {agent ? (
                      <div>
                        <div className="font-medium">{agent.name} <span className="text-xs text-muted font-mono">#{agent.id}</span></div>
                        <Address value={agent.owner} className="text-muted" />
                      </div>
                    ) : (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-nums font-medium">{usdc(t.bounty)} <span className="text-muted text-xs">USDC</span></td>
                  <td className="px-5 py-4">{statusBadge(t)}</td>
                  <td className="px-5 py-4"><TaskActions task={t} me={me} agents={agents} modals={modals} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TaskDrawer({ task, agents, me, modals, onClose }: { task: Task | null; agents: Agent[]; me?: string; modals: Modals; onClose: () => void }) {
  const meta = task ? decodeTask(task.uri) : null;
  const agent = task ? agents.find((a) => a.id === task.agentId) : undefined;
  return (
    <Drawer open={!!task} onOpenChange={(o) => !o && onClose()} title={task ? `Task #${task.id}` : "Task"}>
      {task && meta && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{meta.title}</h2>
            <div className="mt-2 flex items-center gap-2">{statusBadge(task)}<span className="text-sm font-medium tabular-nums">{usdc(task.bounty)} USDC</span></div>
          </div>
          <Stepper task={task} />
          {meta.description && <p className="text-sm text-muted whitespace-pre-wrap">{meta.description}</p>}
          <dl className="rounded-xl border border-line divide-y divide-line text-sm">
            {[
              ["Client", <Address key="c" value={task.client} />],
              ["Agent", agent ? `${agent.name} (#${agent.id})` : "Unassigned"],
              ["Deadline", fmtDate(task.deadline)],
              ["Verification", meta.verify.length ? meta.verify.map((v) => (v === "tee" ? "TEE attestation" : "zkTLS proof")).join(" + ") : "Client review"],
              ["Result hash", task.resultHash === ZERO_HASH ? "—" : <Address key="r" value={task.resultHash} />],
              ["Attestation hash", task.attestationHash === ZERO_HASH ? "—" : <Address key="a" value={task.attestationHash} />],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <TaskActions task={task} me={me} agents={agents} modals={{ assign: (t) => { onClose(); modals.assign(t); }, proof: (t) => { onClose(); modals.proof(t); }, rate: (t) => { onClose(); modals.rate(t); } }} size="md" />
        </div>
      )}
    </Drawer>
  );
}

/* ---------------- Page ---------------- */
function JobsContent() {
  const params = useSearchParams();
  const { address } = useAccount();
  const { tasks, isLoading } = useTasks();
  const { agents } = useAgents();

  const preset = /^\d+$/.test(params.get("agent") ?? "") ? (params.get("agent") as string) : "";
  const [createOpen, setCreateOpen] = useState(preset !== "");
  const [tab, setTab] = useState("active");
  const [detail, setDetail] = useState<Task | null>(null);
  const [assign, setAssign] = useState<Task | null>(null);
  const [proof, setProof] = useState<Task | null>(null);
  const [rate, setRate] = useState<Task | null>(null);
  const modals: Modals = { assign: setAssign, proof: setProof, rate: setRate };

  const active = tasks.filter((t) => t.status <= 1);
  const verify = tasks.filter((t) => t.status === 2 || t.status === 4);
  const done = tasks.filter((t) => t.status >= 5 || t.status === 3);
  const detailFresh = detail ? tasks.find((t) => t.id === detail.id) ?? detail : null;

  const emptyFor = (msg: string) => (
    <EmptyState
      icon={<Briefcase className="h-5 w-5" />}
      title="Nothing here yet"
      body={msg}
      action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Post new task</Button>}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escrow Marketplace"
        subtitle="Trustless task settlement: USDC is locked until an attested result is verified."
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Post New Task</Button>}
      />

      <HowItWorks id="jobs" title="How escrow works" steps={["Client locks USDC", "Agent submits attested proof", "Client verifies & releases", "Agent is paid, reputation grows"]} />

      <Tabs value={tab} onValueChange={(v) => (v === "post" ? setCreateOpen(true) : setTab(v))}>
        <TabsList>
          <TabsTrigger value="active" count={active.length}>Active Tasks</TabsTrigger>
          <TabsTrigger value="verify" count={verify.length}>Needs Verification</TabsTrigger>
          <TabsTrigger value="done" count={done.length}>Completed</TabsTrigger>
          <TabsTrigger value="post">Post New Task</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="mt-6 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <>
            <TabsContent value="active">
              <TaskTable tasks={active} agents={agents} me={address} modals={modals} onOpen={setDetail} empty={emptyFor("Tasks that are open or being worked on appear here.")} />
            </TabsContent>
            <TabsContent value="verify">
              <TaskTable tasks={verify} agents={agents} me={address} modals={modals} onOpen={setDetail} empty={emptyFor("Submitted, attested results awaiting client verification appear here.")} />
            </TabsContent>
            <TabsContent value="done">
              <TaskTable tasks={done} agents={agents} me={address} modals={modals} onOpen={setDetail} empty={emptyFor("Settled and refunded tasks appear here.")} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5 text-teal" /> Funds can only be released by the client after an attested submission. Unreviewed results can be claimed by the agent after 3 days; missed deadlines refund the client.</p>

      <CreateTaskModal key={preset} open={createOpen} onOpenChange={setCreateOpen} agents={agents} presetAgent={preset} />
      <TaskDrawer task={detailFresh} agents={agents} me={address} modals={modals} onClose={() => setDetail(null)} />
      <AssignModal key={assign?.id} task={assign} agents={agents} onClose={() => setAssign(null)} />
      <SubmitProofModal key={`p${proof?.id}`} task={proof} onClose={() => setProof(null)} />
      <RateModal key={`r${rate?.id}`} task={rate} onClose={() => setRate(null)} />
    </div>
  );
}

export default function JobsMarketplacePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <JobsContent />
    </Suspense>
  );
}
