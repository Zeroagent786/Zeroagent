"use client";

import { useState } from "react";
import { usePublicClient } from "wagmi";
import { useAccount } from "../../../hooks/useZeroAccount";
import { hexToBytes, isAddress, isHex, keccak256, parseUnits, toHex, type Hex } from "viem";
import { CheckCircle2, CircleDashed, Copy, FileJson, Play, ScanLine, ShieldCheck, XCircle, Zap } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, PageHeader, cx, inputCls } from "../../../components/ui";
import { useTx } from "../../../hooks/useTx";
import { HowItWorks } from "../../../components/Guide";
import {
  BLOCK_REASONS, ESCROW_ADDRESS, POLICY_GUARD_ADDRESS, REGISTRY_ADDRESS, TASK_STATUS, USDC_DECIMALS, ZERO_ADDRESS,
  escrowAbi, guardAbi, registryAbi,
} from "../../../lib/contracts";
import { errMsg, usdc } from "../../../lib/format";

type ToolName = "execute_policy_trade" | "claim_job_escrow" | "commit_memory_root" | "verify_agent_identity";
type Step = { label: string; state: "pass" | "fail" | "skip"; detail?: string };
type Outcome = { steps: Step[]; ok: boolean; summary: string; response?: unknown; execute?: () => Promise<void> };

const TEMPLATES: Record<ToolName, { desc: string; args: Record<string, unknown> }> = {
  execute_policy_trade: {
    desc: "Spend from an agent account. Enforced by the ERC-7579 Policy Guard.",
    args: { agentAccount: "0x…", target: "0x…", amountUsdc: "25" },
  },
  claim_job_escrow: { desc: "Agent owner claims an unreviewed, attested bounty after the 3-day review window.", args: { taskId: 1 } },
  commit_memory_root: { desc: "Anchor a memory snapshot hash to the agent's registry entry.", args: { agentId: 1, content: "swarm memory snapshot v1" } },
  verify_agent_identity: { desc: "Read an agent's verified on-chain identity.", args: { agentId: 1 } },
};

const json = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);
const now = () => Math.floor(Date.now() / 1000);

/* ---------- Attestation parser (best-effort, structural) ---------- */
function parseQuote(raw: string) {
  const hex = raw.trim();
  if (!isHex(hex) || hex.length < 6) return null;
  const b = hexToBytes(hex as Hex);
  const u16 = (o: number) => (b.length > o + 1 ? (b[o] << 8) | b[o + 1] : undefined);
  const le16 = (o: number) => (b.length > o + 1 ? b[o] | (b[o + 1] << 8) : undefined);
  const sgx = le16(0) === 3 || le16(0) === 4;
  const nitro = b[0] === 0x84 || b[0] === 0xd2;
  return {
    bytes: b.length,
    hash: keccak256(hex as Hex),
    format: sgx ? "Intel SGX/TDX DCAP quote (header match)" : nitro ? "AWS Nitro / COSE_Sign1 document (header match)" : "Unrecognised / mock quote",
    version: sgx ? le16(0) : u16(0),
    teeType: sgx && b.length > 7 ? (b[4] === 0x81 ? "TDX" : b[4] === 0 ? "SGX" : `0x${b[4].toString(16)}`) : undefined,
    signingKey: b.length >= 20 ? toHex(b.slice(b.length - 20)) : undefined,
    measurement: b.length >= 32 ? toHex(b.slice(0, 32)) : undefined,
  };
}

export default function MCPPlaygroundPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const tx = useTx();

  const [tool, setTool] = useState<ToolName>("execute_policy_trade");
  const [input, setInput] = useState(json(TEMPLATES.execute_policy_trade.args));
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);

  const [quote, setQuote] = useState("");
  const [quoteTask, setQuoteTask] = useState("");
  const [match, setMatch] = useState<string | null>(null);
  const parsed = quote ? parseQuote(quote) : null;

  const pickTool = (t: ToolName) => {
    setTool(t);
    setInput(json(TEMPLATES[t].args));
    setOutcome(null);
    setParseErr(null);
  };

  const simulate = async () => {
    if (!publicClient) return;
    setParseErr(null);
    let a: Record<string, string | number>;
    try {
      a = JSON.parse(input);
    } catch {
      return setParseErr("Invalid JSON");
    }
    setRunning(true);
    try {
      setOutcome(await run(tool, a));
    } catch (e) {
      setOutcome({ ok: false, summary: errMsg(e), steps: [{ label: "Execute tool", state: "fail", detail: errMsg(e) }] });
    } finally {
      setRunning(false);
    }
  };

  const run = async (t: ToolName, a: Record<string, string | number>): Promise<Outcome> => {
    const c = publicClient!;
    const steps: Step[] = [];
    const fail = (summary: string): Outcome => ({ steps, ok: false, summary });

    if (t === "execute_policy_trade") {
      const account = String(a.agentAccount ?? "");
      const target = String(a.target ?? "");
      if (!isAddress(account) || !isAddress(target)) {
        steps.push({ label: "Validate inputs", state: "fail", detail: "agentAccount and target must be valid addresses" });
        return fail("Invalid addresses");
      }
      let amount: bigint;
      try { amount = parseUnits(String(a.amountUsdc ?? ""), USDC_DECIMALS); } catch {
        steps.push({ label: "Validate inputs", state: "fail", detail: "amountUsdc must be a number" });
        return fail("Invalid amount");
      }
      steps.push({ label: "Validate inputs", state: "pass" });
      const owner = await c.readContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "agentRootOwners", args: [account] });
      if (owner === ZERO_ADDRESS) {
        steps.push({ label: "Agent account registered with guard", state: "fail", detail: "No root owner. Claim it from the Dashboard first." });
        return fail("Agent account is not registered with the Policy Guard.");
      }
      steps.push({ label: "Agent account registered with guard", state: "pass", detail: `root owner ${owner.slice(0, 8)}…` });
      const p = await c.readContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "policies", args: [account, target] });
      const [limit, spent, lastReset, wl, exp] = p;
      steps.push(wl ? { label: "Target whitelisted", state: "pass" } : { label: "Target whitelisted", state: "fail", detail: "No whitelist entry for this target" });
      const expired = exp !== 0n && BigInt(now()) > exp;
      steps.push(!wl ? { label: "Session not expired", state: "skip" } : expired ? { label: "Session not expired", state: "fail", detail: "Policy expired" } : { label: "Session not expired", state: "pass" });
      const eff = BigInt(now()) >= lastReset + 86400n ? 0n : spent;
      const within = amount + eff <= limit;
      steps.push(!wl || expired ? { label: "Within 24h spend limit", state: "skip" } : within
        ? { label: "Within 24h spend limit", state: "pass", detail: `${usdc(amount)} of ${usdc(limit - eff)} USDC remaining` }
        : { label: "Within 24h spend limit", state: "fail", detail: `Requested ${usdc(amount)} USDC, remaining ${usdc(limit > eff ? limit - eff : 0n)} USDC` });
      const [allowed, reason] = await c.readContract({ address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "simulateSpend", args: [account, target, amount] });
      const summary = allowed
        ? "Transaction would be approved by the policy guard."
        : `Transaction blocked: ${BLOCK_REASONS[reason]}${reason === 3 ? ` of ${usdc(limit)} USDC` : ""}`;
      const canCall = !!address && (address.toLowerCase() === account.toLowerCase() || address.toLowerCase() === owner.toLowerCase());
      return {
        steps, ok: allowed, summary,
        response: { tool: t, allowed, reason: BLOCK_REASONS[reason], guard: POLICY_GUARD_ADDRESS },
        execute: canCall
          ? async () => {
              await tx(allowed ? "Record spend" : "Record blocked attempt", { address: POLICY_GUARD_ADDRESS, abi: guardAbi, functionName: "checkAndRecordSpend", args: [account, target, amount] });
              setOutcome(await run(t, a));
            }
          : undefined,
      };
    }

    if (t === "claim_job_escrow") {
      const id = BigInt(a.taskId ?? 0);
      const task = await c.readContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "tasks", args: [id] });
      if (task[0] === ZERO_ADDRESS) { steps.push({ label: "Task exists", state: "fail" }); return fail(`Task #${id} does not exist`); }
      steps.push({ label: "Task exists", state: "pass", detail: `${usdc(task[3])} USDC · ${TASK_STATUS[task[6]]}` });
      const submitted = task[6] === 2;
      steps.push({ label: "Attested result submitted", state: submitted ? "pass" : "fail", detail: submitted ? undefined : `Status is ${TASK_STATUS[task[6]]}` });
      if (!submitted) return fail("Task has no pending attested submission.");
      const open = now() < Number(task[5]) + 3 * 86400;
      steps.push({ label: "Review window elapsed (3 days)", state: open ? "fail" : "pass", detail: open ? "Client can still verify or dispute" : undefined });
      const owner = await c.readContract({ address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "agents", args: [task[1]] });
      const isOwner = !!address && owner[0].toLowerCase() === address.toLowerCase();
      steps.push({ label: "Caller owns the assigned agent", state: isOwner ? "pass" : "fail", detail: isOwner ? undefined : "Connect the agent owner wallet" });
      const ok = !open && isOwner;
      return {
        steps, ok, summary: ok ? "Bounty is claimable." : open ? "Review window still open." : "Caller is not the agent owner.",
        response: { tool: t, taskId: id, status: TASK_STATUS[task[6]] },
        execute: ok ? async () => { await tx("Claim bounty", { address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "claimBounty", args: [id] }); setOutcome(await run(t, a)); } : undefined,
      };
    }

    if (t === "commit_memory_root") {
      const id = BigInt(a.agentId ?? 0);
      const content = String(a.content ?? "");
      const ag = await c.readContract({ address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "agents", args: [id] });
      if (ag[0] === ZERO_ADDRESS) { steps.push({ label: "Agent exists", state: "fail" }); return fail(`Agent #${id} does not exist`); }
      steps.push({ label: "Agent exists", state: "pass", detail: ag[2] });
      const isOwner = !!address && ag[0].toLowerCase() === address.toLowerCase();
      steps.push({ label: "Caller owns the agent", state: isOwner ? "pass" : "fail", detail: isOwner ? undefined : "Connect the agent owner wallet" });
      const root = keccak256(toHex(content));
      steps.push({ label: "Compute memory root (keccak256)", state: "pass", detail: root });
      return {
        steps, ok: isOwner, summary: isOwner ? "Memory root ready to anchor on-chain." : "Only the agent owner can commit a memory root.",
        response: { tool: t, agentId: id, root, currentRoot: ag[11] },
        execute: isOwner ? async () => { await tx("Commit memory root", { address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "commitMemoryRoot", args: [id, root, `mem://${root}`] }); setOutcome(await run(t, a)); } : undefined,
      };
    }

    // verify_agent_identity
    const id = BigInt(a.agentId ?? 0);
    const ag = await c.readContract({ address: REGISTRY_ADDRESS, abi: registryAbi, functionName: "agents", args: [id] });
    if (ag[0] === ZERO_ADDRESS) { steps.push({ label: "Agent exists", state: "fail" }); return fail(`Agent #${id} does not exist`); }
    steps.push({ label: "Agent exists in registry", state: "pass" });
    steps.push({ label: "Agent active", state: ag[6] ? "pass" : "fail" });
    return {
      steps, ok: ag[6], summary: ag[6] ? `${ag[2]} is a verified, active agent.` : `${ag[2]} is registered but inactive.`,
      response: { agentId: id, name: ag[2], owner: ag[0], capabilities: ag[3], validation: ag[5], tasksCompleted: ag[8], attestationHash: ag[1], registry: REGISTRY_ADDRESS },
    };
  };

  const checkCommitment = async () => {
    if (!publicClient || !parsed || !/^\d+$/.test(quoteTask)) return;
    try {
      const t = await publicClient.readContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "tasks", args: [BigInt(quoteTask)] });
      if (t[0] === ZERO_ADDRESS) return setMatch("Task not found");
      if (t[10] === "0x" + "0".repeat(64)) return setMatch("No attestation submitted for this task yet");
      setMatch(t[10].toLowerCase() === parsed.hash.toLowerCase() ? "✓ Quote hash matches the attestation committed on-chain" : "✗ Quote does NOT match the on-chain attestation hash");
    } catch (e) {
      setMatch(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="MCP Playground" subtitle="Test agent tool calls against the live contracts before deploying capital." action={<Badge tone="teal" dot>Live on-chain</Badge>} />

      <HowItWorks id="playground" title="Try an agent action safely" steps={["Pick a tool on the left", "Simulate it: nothing is sent yet", "See exactly why it passes or is blocked", "Optionally execute it on-chain"]} />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Left: tool caller */}
        <Card className="flex flex-col">
          <CardHeader title="Tool caller" subtitle={TEMPLATES[tool].desc} action={<FileJson className="h-4 w-4 text-muted" />} />
          <div className="p-5 space-y-4 flex-1">
            <Field label="MCP tool">
              <select className={inputCls} value={tool} onChange={(e) => pickTool(e.target.value as ToolName)}>
                {(Object.keys(TEMPLATES) as ToolName[]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Arguments (JSON)">
              <textarea
                spellCheck={false}
                rows={9}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-lg border border-line bg-subtle/50 p-3 font-mono text-xs leading-relaxed focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 scroll-thin"
              />
            </Field>
            {parseErr && <p className="text-xs text-danger">{parseErr}</p>}
            <div className="flex gap-2">
              <Button onClick={simulate} loading={running} className="flex-1"><Play className="h-4 w-4" /> Simulate</Button>
              {tool === "execute_policy_trade" && address && (
                <Button variant="secondary" title="Use your connected wallet as agent account" onClick={() => setInput(json({ ...JSON.parse(input || "{}"), agentAccount: address }))}>Use my wallet</Button>
              )}
            </div>
          </div>
        </Card>

        {/* Center: validator */}
        <Card className="flex flex-col">
          <CardHeader title="Policy validator" subtitle="Step-by-step: why an operation passes or is blocked." action={<ShieldCheck className="h-4 w-4 text-muted" />} />
          <div className="p-5 space-y-3 flex-1">
            {!outcome ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-sm text-muted">
                <CircleDashed className="h-8 w-8 mb-3 text-line-active" />
                Run a simulation to see each policy check.
              </div>
            ) : (
              <>
                <ol className="space-y-2">
                  {outcome.steps.map((s, i) => (
                    <li key={i} className={cx("flex gap-3 rounded-lg border p-3 text-sm", s.state === "pass" ? "border-teal/20 bg-teal/5" : s.state === "fail" ? "border-red-200 bg-red-50" : "border-line bg-subtle/50")}>
                      {s.state === "pass" ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-teal shrink-0" /> : s.state === "fail" ? <XCircle className="h-4 w-4 mt-0.5 text-danger shrink-0" /> : <CircleDashed className="h-4 w-4 mt-0.5 text-muted shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium">{s.label}</p>
                        {s.detail && <p className="text-xs text-muted mt-0.5 break-all">{s.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className={cx("rounded-lg px-3 py-2.5 text-sm font-medium", outcome.ok ? "bg-teal/10 text-teal" : "bg-red-50 text-danger")}>{outcome.summary}</div>
                {outcome.response !== undefined && (
                  <pre className="rounded-lg border border-line bg-subtle/50 p-3 text-[11px] font-mono overflow-x-auto scroll-thin">{json(outcome.response)}</pre>
                )}
                {outcome.execute && (
                  <Button variant="secondary" className="w-full" disabled={!isConnected} onClick={outcome.execute}>
                    <Zap className="h-4 w-4" /> Execute on-chain
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Right: attestation */}
        <Card className="flex flex-col">
          <CardHeader title="TEE attestation receipt" subtitle="Parse a quote and check it against an on-chain commitment." action={<ScanLine className="h-4 w-4 text-muted" />} />
          <div className="p-5 space-y-4 flex-1">
            <Field label="Attestation quote (hex)">
              <textarea
                rows={5}
                spellCheck={false}
                value={quote}
                onChange={(e) => { setQuote(e.target.value); setMatch(null); }}
                placeholder="0x0300020000000000…"
                className="w-full rounded-lg border border-line bg-subtle/50 p-3 font-mono text-xs focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 scroll-thin"
              />
            </Field>
            {quote && !parsed && <p className="text-xs text-danger">Not a valid hex string.</p>}
            {parsed && (
              <dl className="rounded-xl border border-line divide-y divide-line text-xs">
                {[
                  ["Format", parsed.format],
                  ["Size", `${parsed.bytes} bytes`],
                  ["Version", parsed.version ?? "—"],
                  ["TEE type", parsed.teeType ?? "—"],
                  ["Measurement (first 32B)", parsed.measurement ?? "—"],
                  ["Signing key (tail 20B)", parsed.signingKey ?? "—"],
                  ["keccak256 (on-chain form)", parsed.hash],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-muted shrink-0">{k}</dt>
                    <dd className="font-mono text-right break-all">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Task ID" value={quoteTask} onChange={(e) => setQuoteTask(e.target.value.trim())} />
              <Button variant="secondary" disabled={!parsed || !/^\d+$/.test(quoteTask)} onClick={checkCommitment}>Verify</Button>
            </div>
            {match && <p className={cx("text-xs rounded-lg px-3 py-2", match.startsWith("✓") ? "bg-teal/10 text-teal" : "bg-red-50 text-danger")}>{match}</p>}
            <p className="text-[11px] text-muted leading-relaxed">
              MVP note: quotes are parsed structurally and checked against the hash committed on-chain. Full DCAP signature verification requires an enclave provider (Phala / Automata) and is out of MVP scope.
            </p>
            {parsed && (
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(parsed.hash)}><Copy className="h-3.5 w-3.5" /> Copy hash</Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
