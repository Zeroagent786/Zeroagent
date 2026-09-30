"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const SEEN = "zeroagent.splash.seen";
export const REPLAY = "zeroagent.splash.replay";

/** Call before navigating to "/" (e.g. logo click) to play the intro again. */
export function requestIntro() {
  try { sessionStorage.setItem(REPLAY, "1"); } catch {}
}

/** Cinematic intro: plays on the first visit of a session and whenever the logo sends you back to the start page. */
export function Splash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let play = false;
    try {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      play = !reduce && (sessionStorage.getItem(REPLAY) === "1" || sessionStorage.getItem(SEEN) !== "1");
      sessionStorage.setItem(SEEN, "1");
      sessionStorage.removeItem(REPLAY);
    } catch {}
    if (!play) return;
    const a = setTimeout(() => setShow(true), 0);
    const b = setTimeout(() => setShow(false), 2100);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07080A]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease: "easeInOut" } }}
          aria-hidden
        >
          <div className="pointer-events-none absolute h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(13,148,136,0.30),transparent)]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.0, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative h-28 w-28 overflow-hidden rounded-[26px] shadow-[0_0_80px_-10px_rgba(255,255,255,0.35)] ring-1 ring-white/10 md:h-36 md:w-36"
          >
            <Image src="/logo.png" alt="" width={144} height={144} priority className="h-full w-full object-cover" />
            <motion.span
              className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "420%" }}
              transition={{ delay: 0.6, duration: 1.0, ease: "easeInOut" }}
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, letterSpacing: "0.7em" }}
            animate={{ opacity: 1, letterSpacing: "0.3em" }}
            transition={{ delay: 0.35, duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative mt-8 font-[family-name:var(--font-brand)] text-lg font-semibold text-white md:text-2xl"
          >
            ZEROAGENT
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ delay: 1.0, duration: 0.8 }} className="relative mt-3 text-xs tracking-[0.2em] text-white uppercase">
            Verifiable · Policy-gated · On-chain
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
