"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, CircleDot, Circle } from "lucide-react";
import Link from "next/link";
import { SiteFooter, SiteNav } from "../../components/SiteNav";
import { PageHero } from "../../components/PageHero";
import { PHASES, type ItemStatus, type Phase } from "../../lib/roadmap";

const EASE = [0.2, 0.7, 0.2, 1] as const;

const STATE_STYLE: Record<Phase["state"], { chip: string; label: string; node: string }> = {
  live: { chip: "border-teal/30 bg-teal/10 text-teal", label: "Completed", node: "bg-teal border-teal text-white shadow-[0_0_24px_rgba(13,148,136,0.55)]" },
  current: { chip: "border-amber/30 bg-amber/10 text-amber", label: "In progress", node: "bg-ink border-ink text-white shadow-[0_0_24px_rgba(24,24,27,0.35)]" },
  upcoming: { chip: "border-line bg-subtle text-muted", label: "Planned", node: "bg-surface border-line-active text-muted" },
};

const ITEM_ICON: Record<ItemStatus, { icon: typeof Check; cls: string; tag?: string }> = {
  live: { icon: Check, cls: "bg-teal text-white" },
  next: { icon: CircleDot, cls: "bg-amber/15 text-amber", tag: "Next" },
  planned: { icon: Circle, cls: "bg-subtle text-muted border border-line" },
};

function PhaseCard({ p }: { p: Phase }) {
  const s = STATE_STYLE[p.state];
  return (
    <motion.li
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
      className="relative pl-14 md:pl-20"
    >
      <span className={`absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-xl border-2 font-mono text-sm font-semibold md:h-12 md:w-12 ${s.node}`}>
        {p.state === "live" ? <Check className="h-5 w-5" /> : p.n}
      </span>
      <div className={`rounded-2xl border bg-surface/85 p-6 shadow-card backdrop-blur-sm md:p-8 ${p.state === "current" ? "border-ink/70 shadow-[0_24px_70px_-34px_rgba(24,24,27,0.5)]" : "border-line"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted">PHASE {p.n}</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.chip}`}>{s.label}</span>
          {p.when !== s.label && <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-muted">{p.when}</span>}
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">{p.title}</h2>
        <p className="mt-1 text-sm text-muted">{p.blurb}</p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {p.items.map((it, k) => {
            const I = ITEM_ICON[it.status];
            return (
              <motion.li
                key={it.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: 0.05 * k, ease: EASE }}
                className="rounded-xl border border-line bg-subtle/40 p-4 transition-colors hover:border-line-active hover:bg-surface"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${I.cls}`}><I.icon className="h-3 w-3" /></span>
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {it.title}
                      {I.tag && <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber">{I.tag}</span>}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{it.body}</p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.li>
  );
}

export default function RoadmapPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-canvas text-ink">
      <SiteNav />
      <main className="flex-1">
        <PageHero eyebrow="Roadmap" title={<>Verifiable agents today. <span className="bg-gradient-to-r from-white via-[#9BD9D2] to-teal bg-clip-text text-transparent">An open agent economy next.</span></>}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
            Four phases from a working trust stack to a community-governed protocol.
          </p>
          <div className="mt-10 grid grid-cols-4 gap-2 md:gap-3">
            {PHASES.map((p) => (
              <div key={p.n}>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={`h-full rounded-full ${p.state === "upcoming" ? "bg-white/25" : p.state === "current" ? "bg-gradient-to-r from-teal to-amber" : "bg-teal"}`}
                    initial={{ width: 0 }}
                    animate={{ width: p.state === "upcoming" ? "8%" : p.state === "current" ? "45%" : "100%" }}
                    transition={{ duration: 1.1, delay: 0.3 + p.n * 0.12, ease: EASE }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-medium text-white/70 md:text-xs">Phase {p.n}</p>
                <p className="hidden text-[11px] text-white/40 md:block">{p.when}</p>
              </div>
            ))}
          </div>
        </PageHero>

        <section className="relative mx-auto -mt-14 max-w-5xl px-5 pb-24 md:pb-28">
          <div className="relative">
            <div className="absolute bottom-4 left-5 top-4 w-px bg-gradient-to-b from-teal via-line-active to-transparent md:left-6" aria-hidden />
            <ol className="space-y-8 md:space-y-10">
              {PHASES.map((p) => <PhaseCard key={p.n} p={p} />)}
            </ol>
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-4 rounded-2xl border border-line bg-surface/85 p-6 text-center backdrop-blur-sm md:flex-row md:p-8 md:text-left">
            <div>
              <p className="text-lg font-semibold tracking-tight">See where $ZERO fits in the roadmap</p>
              <p className="mt-1 text-sm text-muted">Supply, allocation and planned token utility, in one place.</p>
            </div>
            <Link href="/tokenomics" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-[#27272A]">
              View tokenomics <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-6 text-center text-xs text-muted">Timelines are targets, not guarantees, and may change.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
