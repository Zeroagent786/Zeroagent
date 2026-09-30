"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, Cpu, Landmark, ShieldCheck, ShieldX, User, type LucideIcon } from "lucide-react";

type Node = { key: string; label: string; sub: string; icon: LucideIcon };
const NODES: Node[] = [
  { key: "owner", label: "You", sub: "set the rules", icon: User },
  { key: "agent", label: "AI Agent", sub: "asks to spend", icon: Bot },
  { key: "guard", label: "Policy Guard", sub: "checks the rules", icon: ShieldCheck },
  { key: "tee", label: "TEE Proof", sub: "proves the work", icon: Cpu },
  { key: "escrow", label: "Escrow", sub: "pays out", icon: Landmark },
];

type Scenario = { title: string; amount: string; blocked: boolean; logs: string[] };
const SCENARIOS: Scenario[] = [
  {
    title: "Within limits",
    amount: "$25",
    blocked: false,
    logs: [
      "you   → policy set: $50/day · whitelist Uniswap · 7 days",
      "agent → request: swap $25 USDC on Uniswap",
      "guard → ✓ whitelisted  ✓ under $50/day  ✓ not expired",
      "tee   → ✓ enclave quote attested, result hash committed",
      "escrow→ ✓ $25 released · agent reputation +1",
    ],
  },
  {
    title: "Out of policy",
    amount: "$80",
    blocked: true,
    logs: [
      "you   → policy set: $50/day · whitelist Uniswap · 7 days",
      "agent → request: swap $80 USDC on Uniswap",
      "guard → ✗ exceeds the $50/day limit",
      "tee   → skipped",
      "escrow→ nothing moved · your wallet stays safe",
    ],
  },
];

const STEP_MS = 1300;
const HOLD = 3; // extra ticks to linger on the final state

export function LifecycleDemo() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const cycle = NODES.length + HOLD;
  const scenario = SCENARIOS[Math.floor(tick / cycle) % SCENARIOS.length];
  const phase = tick % cycle;
  const reach = Math.min(phase, NODES.length - 1); // node currently active
  const guardIdx = 2;
  const stopAt = scenario.blocked ? guardIdx : NODES.length - 1;
  const cur = Math.min(reach, stopAt);
  const finished = phase >= stopAt;

  const spent = scenario.blocked ? 25 : cur >= 4 ? 25 : 0;
  const blocked = scenario.blocked ? (cur >= guardIdx ? 1 : 0) : 0;

  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="absolute -inset-10 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(13,148,136,0.16),transparent_70%)]" aria-hidden />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_90px_-30px_rgba(24,24,27,0.3)]">
        <div className="flex items-center gap-2 border-b border-line bg-subtle/60 px-4 h-11">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E5E0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E5E0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E5E0]" />
          <span className="ml-3 font-mono text-xs text-muted">how a single agent action flows</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={scenario.title}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                scenario.blocked ? "border-red-200 bg-red-50 text-danger" : "border-teal/25 bg-teal/10 text-teal"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              {scenario.title}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="px-4 pt-8 pb-6 md:px-10 md:pt-10">
          {/* pipeline: connectors live BETWEEN nodes, never behind them */}
          <div className="flex items-start">
            {NODES.map((n, i) => {
              const isBlockedNode = scenario.blocked && i === guardIdx && cur >= guardIdx;
              const done = i < cur || (i === cur && finished && !isBlockedNode);
              const active = i === cur && !finished;
              const dim = scenario.blocked && i > guardIdx;
              const segmentFilled = i < cur;
              const segmentBlocked = scenario.blocked && i >= guardIdx;
              return (
                <div key={n.key} className="flex flex-1 items-start last:flex-none">
                  <div className="flex w-14 flex-col items-center text-center md:w-24">
                    <div className="relative">
                      {active && (
                        <motion.span
                          className={`absolute inset-0 rounded-2xl ${isBlockedNode ? "bg-danger/30" : "bg-teal/30"}`}
                          initial={{ scale: 1, opacity: 0.7 }}
                          animate={{ scale: 1.7, opacity: 0 }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                      )}
                      <motion.div
                        animate={{ scale: active ? 1.1 : 1 }}
                        transition={{ type: "spring", stiffness: 280, damping: 18 }}
                        className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-colors duration-500 md:h-16 md:w-16 ${
                          isBlockedNode
                            ? "border-danger bg-danger text-white shadow-[0_8px_24px_-6px_rgba(220,38,38,0.6)]"
                            : active
                            ? "border-ink bg-ink text-white shadow-[0_8px_24px_-6px_rgba(24,24,27,0.5)]"
                            : done
                            ? "border-teal bg-teal text-white shadow-[0_8px_24px_-8px_rgba(13,148,136,0.6)]"
                            : dim && cur >= guardIdx
                            ? "border-line bg-subtle text-line-active"
                            : "border-line bg-surface text-muted"
                        }`}
                      >
                        {isBlockedNode ? <ShieldX className="h-5 w-5 md:h-7 md:w-7" /> : done && !active && i > 0 ? <Check className="h-5 w-5 md:h-7 md:w-7" /> : <n.icon className="h-5 w-5 md:h-7 md:w-7" />}
                      </motion.div>
                    </div>
                    <span className={`mt-3 text-[11px] font-semibold md:text-sm ${dim && cur >= guardIdx ? "text-muted/60" : "text-ink"}`}>{n.label}</span>
                    <span className="hidden text-[11px] text-muted md:block">{n.sub}</span>
                  </div>

                  {i < NODES.length - 1 && (
                    <div className="relative mx-1 mt-6 h-[3px] flex-1 overflow-hidden rounded-full bg-line md:mt-8 md:mx-2">
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-full ${segmentBlocked ? "bg-danger" : "bg-teal"}`}
                        initial={false}
                        animate={{ width: segmentFilled ? "100%" : "0%" }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                      {i === cur && !finished && (
                        <motion.span
                          key={`${tick}-${i}`}
                          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_12px_3px_rgba(13,148,136,0.7)]"
                          initial={{ left: "-4%" }}
                          animate={{ left: "100%" }}
                          transition={{ duration: STEP_MS / 1000, ease: "easeInOut" }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* terminal */}
          <div className="mt-8 rounded-xl border border-line bg-[#111113] p-4 font-mono text-[11.5px] leading-6 md:p-5 md:text-[13px]">
            {scenario.logs.slice(0, cur + 1).map((l, i) => {
              const bad = l.includes("✗") || l.startsWith("escrow→ nothing");
              const good = l.includes("✓");
              return (
                <motion.div
                  key={`${scenario.title}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={bad ? "text-red-400" : good ? "text-teal-300" : "text-zinc-400"}
                >
                  {l}
                </motion.div>
              );
            })}
            <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-zinc-500" />
          </div>

          {/* live counters */}
          <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
            {[
              ["Daily cap", "$50", "text-ink"],
              ["Spent today", `$${spent}`, "text-ink"],
              ["Blocked", String(blocked), blocked ? "text-danger" : "text-ink"],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-line bg-surface py-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted">{k}</div>
                <motion.div key={v} initial={{ scale: 1.25, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className={`mt-0.5 text-lg font-semibold tabular-nums ${c}`}>
                  {v}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
