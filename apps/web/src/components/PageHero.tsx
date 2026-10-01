"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import HeroBackground from "./HeroBackground";

const EASE = [0.2, 0.7, 0.2, 1] as const;

/** Dark cinematic header used by the public info pages. Fades into the light canvas below. */
export function PageHero({ eyebrow, title, children, pad = "pb-28" }: { eyebrow: string; title: ReactNode; children?: ReactNode; pad?: string }) {
  return (
    <section className={`relative overflow-hidden bg-[#07080A] px-5 pt-20 md:pt-28 ${pad}`}>
      <HeroBackground />
      <div className="relative mx-auto max-w-5xl">
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="text-xs font-semibold uppercase tracking-[0.22em] text-teal">
          {eyebrow}
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: EASE }} className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
          {title}
        </motion.h1>
        {children && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18, ease: EASE }}>
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
}
