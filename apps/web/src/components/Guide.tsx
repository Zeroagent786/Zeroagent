"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAccount } from "../hooks/useZeroAccount";
import { ArrowRight, Check, HelpCircle, X } from "lucide-react";
import { useAgents, useMyPolicies, useTasks } from "../hooks/useChainData";
import { cx } from "./ui";

/* localStorage flag as an external store (SSR-safe, no effect-driven setState) */
const listeners = new Set<() => void>();
const read = (k: string) => {
  try { return localStorage.getItem(k) === "1"; } catch { return false; }
};
function useFlag(key: string): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => read(key),
    () => false
  );
  const set = (val: boolean) => {
    try { localStorage.setItem(key, val ? "1" : "0"); } catch {}
    listeners.forEach((l) => l());
  };
  return [v, set];
}

/** Dashboard onboarding checklist. Progress is derived from real on-chain state. */
export function GetStarted() {
  const { address, isConnected } = useAccount();
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { data: pol } = useMyPolicies(address);
  const [hidden, setHidden] = useFlag("zeroagent.guide.hidden");

  const me = address?.toLowerCase();
  const myAgents = agents.filter((a) => a.owner.toLowerCase() === me);
  const myTasks = tasks.filter((t) => t.client.toLowerCase() === me);
  const steps = [
    { title: "Connect a wallet & add funds", body: "You need a little ETH for gas and USDC for escrows.", done: isConnected, links: [] as [string, string][], cta: null as null | [string, string] },
    { title: "Register your first agent", body: "Give your AI a verifiable on-chain identity. Others can hire it and its reputation starts building.", done: myAgents.length > 0, links: [], cta: ["Register an agent", "/app/agents"] as [string, string] },
    { title: "Set a spending policy", body: "Choose a daily USDC limit and an allowed target. Out-of-policy spends get blocked on-chain.", done: (pol?.policies.length ?? 0) > 0, links: [], cta: ["Create a policy", "#policies"] as [string, string] },
    { title: "Post a task with escrow", body: "Lock USDC for an agent. It is only paid once you verify the attested result.", done: myTasks.length > 0, links: [], cta: ["Post a task", "/app/jobs"] as [string, string] },
    { title: "Release payment & rate the agent", body: "Verify the proof, release the funds, and leave a rating. That reputation is permanent.", done: myTasks.some((t) => t.status === 3), links: [], cta: ["Open marketplace", "/app/jobs"] as [string, string] },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);

  if (hidden) {
    return (
      <button onClick={() => setHidden(false)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
        <HelpCircle className="h-3.5 w-3.5" /> Show getting-started guide
      </button>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal">Getting started</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Give agents power, not your wallet.</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            ZeroAgent lets an AI agent work for you inside strict on-chain rules, and only pays it for proven work. Follow these five steps to see the full loop.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{doneCount}<span className="text-muted text-base">/{steps.length}</span></div>
            <div className="text-[11px] text-muted">steps done</div>
          </div>
          <button onClick={() => setHidden(true)} aria-label="Hide guide" className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="relative h-1 bg-subtle"><div className="h-full bg-teal transition-all duration-700" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
      <ol className="relative grid gap-px bg-line md:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.title} className={cx("flex flex-col bg-surface p-5", i === currentIdx && "bg-subtle")}>
            <span className={cx("flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold", s.done ? "border-teal bg-teal text-white" : i === currentIdx ? "border-ink bg-ink text-white" : "border-line text-muted")}>
              {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <h3 className="mt-3 text-sm font-semibold leading-snug">{s.title}</h3>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{s.body}</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {s.links.map(([l, h]) => <a key={l} href={h} target="_blank" rel="noreferrer" className="text-xs font-medium underline">{l}</a>)}
              {s.cta && !s.done && (
                <Link href={s.cta[1]} className="inline-flex items-center gap-1 text-xs font-medium hover:underline">{s.cta[0]} <ArrowRight className="h-3 w-3" /></Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Small dismissible "how this page works" strip. */
export function HowItWorks({ id, title, steps }: { id: string; title: string; steps: string[] }) {
  const [hidden, setHidden] = useFlag(`zeroagent.hint.${id}`);
  if (hidden) return null;
  return (
    <div className="flex items-start gap-4 rounded-xl border border-line bg-subtle/50 px-5 py-4">
      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[9px] font-semibold text-white">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </div>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
    </div>
  );
}
