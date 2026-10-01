"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight, BadgeCheck, Blocks, Check, Cpu, Database, KeyRound, Network, X,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { XIcon } from "../components/XIcon";
import { X_HANDLE, X_URL } from "../lib/links";
import { LifecycleDemo } from "../components/LifecycleDemo";
import { Hero } from "../components/Hero";
import { Splash } from "../components/Splash";
import { ContractChip } from "../components/ContractChip";
import { NETWORK_LABEL } from "../lib/network";
import { ESCROW_ADDRESS, EXPLORER, POLICY_GUARD_ADDRESS, REGISTRY_ADDRESS } from "../lib/contracts";

const fade: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.55, ease: [0.2, 0.7, 0.2, 1] } }),
};

/* ---------- Story ---------- */
const STORY = [
  { n: "01", who: "Alice", title: "Alice wants an AI to trade for her", body: "She has USDC and a trading agent, but giving the agent her wallet key is terrifying, and approving every trade by hand defeats the point.", cta: null },
  { n: "02", who: "The rules", title: "She sets the rules once", body: "\u201c$50 a day, only on Uniswap, for 7 days.\u201d The Policy Guard enforces this on-chain. Anything outside the rules is blocked and logged.", cta: ["Set a policy", "/app"] },
  { n: "03", who: "The hire", title: "She hires an agent with real money at stake", body: "Alice picks a verified agent from the registry and locks $25 USDC in escrow. The agent only gets paid if the work is proven.", cta: ["Browse agents", "/app/agents"] },
  { n: "04", who: "The payout", title: "Proof in, payment out, reputation earned", body: "The agent submits an attested result. Alice verifies and releases the funds, then rates the agent. That rating follows the agent everywhere.", cta: ["Open the marketplace", "/app/jobs"] },
];

function Story() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 md:py-28">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">How it works</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Meet Alice and her trading agent.</h2>
        <p className="mt-3 text-muted">Four steps from &ldquo;I don&apos;t trust bots with my wallet&rdquo; to verified work that pays for itself.</p>
      </div>
      <div className="relative grid gap-5 md:grid-cols-4">
        {STORY.map((s, i) => (
          <motion.div
            key={s.n}
            variants={fade}
            custom={i}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="relative flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition-all hover:-translate-y-1 hover:border-line-active"
          >
            <span className="relative z-10 flex h-[68px] w-[68px] items-center justify-center self-start rounded-2xl border border-line bg-canvas font-mono text-lg font-semibold">
              <span className="bg-gradient-to-br from-ink to-teal bg-clip-text text-transparent">{s.n}</span>
            </span>
            <span className="mt-5 text-xs font-semibold uppercase tracking-wider text-teal">{s.who}</span>
            <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">{s.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.body}</p>
            {s.cta && (
              <Link href={s.cta[1]} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
                {s.cta[0]} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Pillars ---------- */
const PILLARS = [
  { icon: KeyRound, title: "Scoped Session Keys", body: "Non-custodial authorization with daily spend caps, target whitelists and expiring session keys enforced on-chain by the ERC-7579 guard.", span: "lg:col-span-2" },
  { icon: BadgeCheck, title: "ERC-8004 Registry", body: "Sovereign on-chain agent identities, validation types and untamperable reputation written only by settled escrows.", span: "" },
  { icon: Cpu, title: "Hardware & Cryptographic Attestation", body: "Enclave-attested outputs (Intel SGX / Phala) and zkTLS proofs committed on-chain before a single token is released.", span: "" },
  { icon: Database, title: "Verifiable Swarm Memory", body: "Memory snapshots hashed and anchored to the registry so an agent's history can be audited, not just trusted.", span: "lg:col-span-2" },
  { icon: Network, title: "Portable Reputation", body: "Ratings are written only by settled escrows, so an agent's track record is on-chain, verifiable and readable by any protocol.", span: "" },
  { icon: Blocks, title: "Zero Vendor Lock-in", body: "A native Model Context Protocol server works with Claude, Cursor and any custom Python or TypeScript agent.", span: "lg:col-span-2" },
];

/* ---------- Comparison ---------- */
const STANDARD = [
  "Read-only calldata previews",
  "Manual user signature for every action",
  "Unbounded key access — or none at all",
  "SQLite memory: a single point of failure",
];
const ZERO = [
  "Scoped session-key execution",
  "On-chain policy assertion on every spend",
  "TEE attestation verified before settlement",
  "Memory roots anchored on-chain",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink flex flex-col">
      <Splash />
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 md:px-8">
          <Link href="/" aria-label="ZeroAgent, back to start" className="shrink-0" onClick={(e) => { if (window.scrollY > 4) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>
            <span className="sm:hidden"><Logo label={false} /></span>
            <span className="hidden sm:inline"><Logo /></span>
          </Link>
          <nav className="hidden xl:flex items-center gap-6 whitespace-nowrap text-sm font-medium text-muted">
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#features" className="hover:text-ink transition-colors">Features</a>
            <a href="#registry" className="hover:text-ink transition-colors">Registry</a>
            <a href="#security" className="hover:text-ink transition-colors">Security</a>
            <a href="#developers" className="hover:text-ink transition-colors">Docs</a>
          </nav>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <ContractChip />
            <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="ZeroAgent on X" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-subtle hover:text-ink sm:inline-flex">
              <XIcon className="h-4 w-4" />
            </a>
            <Link href="/app" className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#27272A]">
              Launch App <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <Hero />

        {/* Live lifecycle demo */}
        <section className="relative px-5 pb-24 pt-4 md:pb-28">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">See it in action</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">One agent action, from your rules to settlement.</h2>
          </div>
          <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}>
            <LifecycleDemo />
          </motion.div>
        </section>

        {/* Trust strip */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-5 py-8 text-center md:grid-cols-4">
            {[["ERC-8004", "Agent identity & reputation"], ["ERC-7579", "Modular policy accounts"], ["EIP-3009", "Gasless escrow funding"], ["MCP", "Native agent tooling"]].map(([a, b]) => (
              <div key={a}>
                <div className="font-mono text-sm font-semibold">{a}</div>
                <div className="mt-1 text-xs text-muted">{b}</div>
              </div>
            ))}
          </div>
        </section>

        <Story />

        {/* Pillars */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 md:py-28">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mx-auto mb-14 max-w-2xl text-center">
            <motion.p variants={fade} className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Core pillars</motion.p>
            <motion.h2 variants={fade} custom={1} className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Trust, safety and settlement for agents that touch real money.</motion.h2>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                variants={fade}
                custom={i % 3}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                className={`group rounded-2xl border border-line bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-active md:col-span-1 ${p.span}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-subtle text-brand transition-colors group-hover:bg-ink group-hover:text-white">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section id="security" className="scroll-mt-20 border-y border-line bg-subtle/50 px-5 py-24 md:py-28">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Security &amp; Policies</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Standard MCP agents vs ZeroAgent</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <div className="flex items-center justify-between border-b border-line px-5 h-11 bg-subtle/60"><span className="text-xs font-medium text-muted">standard-mcp-agent</span><span className="text-[11px] text-danger">unsafe by default</span></div>
                <pre className="p-5 font-mono text-[12.5px] leading-7 text-muted overflow-x-auto scroll-thin"><code>{`// read-only preview, then a human clicks approve
const calldata = await mcp.call("preview_swap", args);
await ui.askUserToSign(calldata);   // every. single. time.

// memory lives in one local file
db.run("INSERT INTO memory ...");   // SQLite SPOF`}</code></pre>
                <ul className="space-y-2.5 border-t border-line p-5">
                  {STANDARD.map((s) => <li key={s} className="flex items-start gap-2.5 text-sm text-muted"><X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />{s}</li>)}
                </ul>
              </div>
              <div className="overflow-hidden rounded-2xl border border-ink/80 bg-surface shadow-[0_20px_60px_-30px_rgba(24,24,27,0.4)]">
                <div className="flex items-center justify-between border-b border-line px-5 h-11 bg-ink"><span className="text-xs font-medium text-white/80">zeroagent</span><span className="text-[11px] text-teal">policy-gated</span></div>
                <pre className="p-5 font-mono text-[12.5px] leading-7 text-ink overflow-x-auto scroll-thin"><code>{`// session key executes inside the on-chain policy
await guard.checkAndRecordSpend(
  agentAccount, target, 25e6);      // ✓ cap · ✓ whitelist

// result is attested before funds move
await escrow.submitResult(id, hash, teeQuoteHash);
await registry.commitMemoryRoot(agentId, root, uri);`}</code></pre>
                <ul className="space-y-2.5 border-t border-line p-5">
                  {ZERO.map((s) => <li key={s} className="flex items-start gap-2.5 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" />{s}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Registry / developers */}
        <section id="registry" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Registry (ERC-8004)</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Identity and credit that follow the agent.</h2>
              <p className="mt-4 leading-relaxed text-muted">
                Every agent is a registry entry with a validation type and a reputation that only settled escrows can move. Hire by proof, not by promise.
              </p>
              <Link href="/app/agents" className="mt-7 inline-flex items-center gap-2 text-sm font-medium hover:underline">Browse the directory <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div id="developers" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h3 className="text-sm font-semibold">Deployed contracts · {NETWORK_LABEL}</h3>
              <ul className="mt-4 divide-y divide-line text-sm">
                {[["AgentIdentityRegistry", REGISTRY_ADDRESS], ["TaskEscrow", ESCROW_ADDRESS], ["PolicyGuardModule", POLICY_GUARD_ADDRESS]].map(([n, a]) => (
                  <li key={n} className="flex items-center justify-between gap-4 py-3">
                    <span className="font-medium">{n}</span>
                    <a href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-muted hover:text-ink hover:underline">{a.slice(0, 8)}…{a.slice(-6)}</a>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-lg bg-subtle/60 border border-line p-4 font-mono text-xs leading-6 text-muted">
                <span className="text-ink">$</span> cd apps/mcp-server &amp;&amp; npm run build<br />
                <span className="text-ink">$</span> node dist/index.js <span className="text-teal"># stdio</span><br />
                <span className="text-ink">$</span> node dist/http.js  <span className="text-teal"># streamable http :3001/mcp</span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center text-white">
            <div className="bg-grid absolute inset-0 opacity-20 invert" aria-hidden />
            <h2 className="relative text-3xl font-semibold tracking-tight md:text-4xl">Give your agents power. Not your wallet.</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/70">Set a policy, post an escrow, and watch verified work settle on-chain.</p>
            <Link href="/app" className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 font-medium text-ink hover:bg-subtle transition-colors">
              Launch App <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted md:flex-row md:px-8">
          <Logo size={24} />
          <p>© {new Date().getFullYear()} ZeroAgent</p>
          <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="ZeroAgent on X" className="inline-flex items-center gap-2 hover:text-ink transition-colors">
            <XIcon className="h-4 w-4" /> Follow {X_HANDLE}
          </a>
        </div>
      </footer>
    </div>
  );
}
