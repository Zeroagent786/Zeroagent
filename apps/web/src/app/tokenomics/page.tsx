"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Bot, Coins, ExternalLink, Flame, Gift, Landmark, Lock, Scale, ShieldCheck, Vote } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { SiteFooter, SiteNav } from "../../components/SiteNav";
import { PageHero } from "../../components/PageHero";
import { ContractChip } from "../../components/ContractChip";
import { ALLOCATIONS, TOTAL_SUPPLY, UTILITIES, type Utility } from "../../lib/roadmap";
import { BURN_TX_URL, LAUNCHPAD_URL, TOKEN_EXPLORER_URL } from "../../lib/links";

const EASE = [0.2, 0.7, 0.2, 1] as const;

function CountUp({ to }: { to: number }) {
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => Math.round(v).toLocaleString("en-US"));
  useEffect(() => {
    const c = animate(mv, to, { duration: 2, ease: "easeOut" });
    return () => c.stop();
  }, [mv, to]);
  return <motion.span>{txt}</motion.span>;
}

/* ---- donut ---- */
function Donut() {
  const R = 72, SW = 20;
  const starts = ALLOCATIONS.map((_, i) => ALLOCATIONS.slice(0, i).reduce((t, x) => t + x.pct / 100, 0));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      <div className="absolute inset-6 rounded-full bg-[radial-gradient(closest-side,rgba(13,148,136,0.18),transparent)] blur-xl" aria-hidden />
      <svg viewBox="0 0 200 200" className="relative h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#E8E8E3" strokeWidth={SW} />
        {ALLOCATIONS.map((a, i) => {
          const frac = a.pct / 100;
          const start = starts[i];
          const gap = 0.006;
          return (
            <motion.circle
              key={a.label} cx="100" cy="100" r={R} fill="none" stroke={a.color} strokeWidth={SW} strokeLinecap="butt"
              pathLength={1} strokeDashoffset={-start}
              initial={{ strokeDasharray: "0 1" }}
              whileInView={{ strokeDasharray: `${Math.max(frac - gap, 0)} ${1 - Math.max(frac - gap, 0)}` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.2 + i * 0.25, ease: EASE }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Total supply</span>
        <span className="mt-1 text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">1,000,000,000</span>
        <span className="mt-1 font-mono text-xs text-teal">$ZERO</span>
      </div>
    </div>
  );
}

const U_ICON: Record<Utility["icon"], typeof Lock> = { bond: Lock, reward: Gift, gov: Vote, fee: Scale, treasury: Landmark };

/* ---- the planned token loop ---- */
const LOOP = [
  { icon: Lock, t: "Stake a bond", d: "Agents bond $ZERO to take paid work" },
  { icon: Bot, t: "Complete verified work", d: "Escrow releases on attested proof" },
  { icon: ShieldCheck, t: "Earn reputation", d: "Written on-chain by settled escrows" },
  { icon: Gift, t: "Receive rewards", d: "Reputation-weighted ecosystem pool" },
  { icon: Vote, t: "Shape the protocol", d: "Governance over parameters & fees" },
];

function TokenLoop() {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-line-active to-transparent lg:block" aria-hidden />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {LOOP.map((s, i) => (
          <motion.li key={s.t} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.09, ease: EASE }} className="relative text-center">
            <motion.span
              animate={{ boxShadow: ["0 0 0 0 rgba(13,148,136,0)", "0 0 0 10px rgba(13,148,136,0.14)", "0 0 0 0 rgba(13,148,136,0)"] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.5 }}
              className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface text-brand"
            >
              <s.icon className="h-6 w-6" />
            </motion.span>
            <p className="mt-3 text-sm font-semibold">{i + 1}. {s.t}</p>
            <p className="mt-1 px-2 text-xs leading-relaxed text-muted">{s.d}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

export default function TokenomicsPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-canvas text-ink">
      <SiteNav />
      <main className="flex-1">
        <PageHero eyebrow="Tokenomics" title={<span className="bg-gradient-to-r from-white via-[#9BD9D2] to-teal bg-clip-text text-transparent">$ZERO</span>} pad="pb-32">
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
            The coordination token of the ZeroAgent network, built so that more verified agent work means more demand for trust.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { k: "Total supply", v: <CountUp to={TOTAL_SUPPLY} /> },
              { k: "Dev allocation", v: <>0%</> },
              { k: "Launchpad", v: <>ponsfamily.com</> },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-white/15 bg-white/5 px-5 py-4 backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{s.k}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-white md:text-2xl">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ContractChip fullFrom="sm" variant="dark" />
            <a href={LAUNCHPAD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/10">
              View on ponsfamily.com <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {TOKEN_EXPLORER_URL && (
              <a href={TOKEN_EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 text-sm text-white/70 underline hover:text-white">Contract on explorer</a>
            )}
            {BURN_TX_URL && (
              <a href={BURN_TX_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 text-sm text-teal underline">Verify dev-supply burn on-chain</a>
            )}
          </div>
        </PageHero>

        {/* Distribution */}
        <section className="relative mx-auto -mt-16 max-w-5xl px-5">
          <div className="rounded-3xl border border-line bg-surface/90 p-6 shadow-[0_30px_80px_-40px_rgba(24,24,27,0.35)] backdrop-blur-sm md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Distribution</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">One billion tokens. No developer allocation.</h2>
            <div className="mt-8 grid items-center gap-10 md:grid-cols-[340px_1fr]">
              <Donut />
              <div className="space-y-3">
                {ALLOCATIONS.map((a, i) => (
                  <motion.div key={a.label} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 * i, ease: EASE }} className="rounded-xl border border-line bg-subtle/40 p-4 transition-colors hover:bg-surface">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5 text-sm font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: a.color }} />{a.label}</span>
                      <span className="text-lg font-semibold tabular-nums">{a.pct}%</span>
                    </div>
                    <p className="mt-1 text-xs font-mono text-muted">{a.tokens} $ZERO</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">{a.purpose}</p>
                  </motion.div>
                ))}
                <div className="flex items-start gap-3 rounded-xl border border-teal/25 bg-teal/5 p-4">
                  <Flame className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                  <p className="text-[13px] leading-relaxed"><span className="font-semibold">0% developer allocation.</span> The developer supply is burned, so the team holds no pre-allocated tokens.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Utility */}
        <section className="mx-auto max-w-6xl px-5 py-24 md:py-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Utility</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Where $ZERO fits in ZeroAgent</h2>
            <p className="mt-3 text-muted">Planned token utility, mapped to the roadmap. None of this is live today.</p>
          </div>
          <TokenLoop />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UTILITIES.map((u, i) => {
              const I = U_ICON[u.icon];
              return (
                <motion.div key={u.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: EASE }} className="group rounded-2xl border border-line bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-active">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-subtle text-brand transition-colors group-hover:bg-ink group-hover:text-white"><I className="h-5 w-5" /></span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{u.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{u.body}</p>
                  <span className="mt-4 inline-block rounded-full border border-amber/30 bg-amber/10 px-2.5 py-0.5 text-[11px] font-medium text-amber">{u.phase}</span>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CTA + disclosure */}
        <section className="mx-auto max-w-5xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-12 text-center text-white">
            <div className="bg-grid absolute inset-0 opacity-20 invert" aria-hidden />
            <Coins className="relative mx-auto h-8 w-8 text-teal" />
            <h2 className="relative mt-4 text-2xl font-semibold tracking-tight md:text-3xl">Follow the build</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/65">See what ships next, or try the platform today.</p>
            <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/roadmap" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-medium text-ink hover:bg-subtle">View roadmap <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/app" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/25 px-5 text-sm font-medium text-white hover:bg-white/10">Launch App</Link>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-[11px] leading-relaxed text-muted">
            Information on this page is for general purposes only and is not financial, legal or investment advice, nor an offer or solicitation. Token utility described is planned and subject to change, and nothing here guarantees any return or price. Digital assets are volatile and you can lose everything you put in. Do your own research.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
