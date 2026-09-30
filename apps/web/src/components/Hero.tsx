"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import HeroBackground from "./HeroBackground";

const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1];
const CAP = 50;
const SPENT = 25;

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: EASE },
  };
}

function PolicyCard() {
  const [approved, setApproved] = useState(true);
  const spent = useMotionValue(0);
  const label = useTransform(spent, (v) => `$${v.toFixed(2)}`);
  const width = useTransform(spent, (v) => `${(v / CAP) * 100}%`);

  useEffect(() => {
    const id = window.setInterval(() => setApproved((a) => !a), 3000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const controls = animate(spent, approved ? SPENT : 0, { duration: 1.4, ease: EASE });
    return () => controls.stop();
  }, [approved, spent]);

  return (
    <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium tracking-wide text-white/90">Agent policy</span>
        <span className="font-mono text-[11px] text-white/40">ERC-7579</span>
      </div>

      <dl className="mt-6 space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-white/55">Daily cap</dt>
          <dd className="font-mono text-white">$50.00</dd>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <dt className="text-white/55">Spent today</dt>
            <dd className="font-mono text-white">
              <motion.span>{label}</motion.span>
            </dd>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-slate-200 to-teal"
              style={{ width }}
            />
          </div>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-xs text-white/45">Latest request</span>
        <motion.span
          key={approved ? "ok" : "no"}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            approved
              ? "border-teal/40 bg-teal/15 text-teal-300"
              : "border-red-400/40 bg-red-500/15 text-red-300"
          }`}
        >
          {approved ? "Approved" : "Blocked · over limit"}
        </motion.span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[88vh] w-full flex-col overflow-hidden bg-[#07080A] text-white">
      <HeroBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-start justify-center gap-12 px-5 pb-28 pt-28 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-3xl">
          <motion.div
            {...fadeUp(0.05)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            ERC-8004 · ERC-7579 · EIP-3009
          </motion.div>

          <motion.h1
            {...fadeUp(0.15)}
            className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            Verifiable, policy-gated{" "}
            <span className="bg-gradient-to-r from-slate-100 via-slate-300 to-teal bg-clip-text text-transparent">
              coordination for autonomous on-chain agents.
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.3)}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg"
          >
            Break past read-only previews. Delegate scoped session keys via ERC-7579, verify task
            execution inside hardware enclaves, and tap into unified ERC-8004 identity.
          </motion.p>

          <motion.div {...fadeUp(0.45)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#07080A] transition hover:bg-white/90"
            >
              Launch App →
            </Link>
            <a
              href="https://modelcontextprotocol.io/specification"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
            >
              View MCP Spec
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: EASE }}
          className="hidden w-full shrink-0 justify-end lg:flex lg:w-auto"
        >
          <PolicyCard />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#07080A]/40"
      >
        <span>Scroll</span>
        <span className="h-6 w-px bg-gradient-to-b from-[#07080A]/40 to-transparent" />
      </motion.div>
    </section>
  );
}

export default Hero;
