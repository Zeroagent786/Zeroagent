"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { ZERO_TOKEN } from "../lib/links";

/** $ZERO contract address pill for the top navbar. Full address on wide screens, shortened on small ones; click copies. */
export function ContractChip({ fullFrom = "lg", variant = "light" }: { fullFrom?: "lg" | "xl" | "sm"; variant?: "light" | "dark" }) {
  const full = fullFrom === "xl" ? "hidden xl:inline" : fullFrom === "sm" ? "hidden sm:inline" : "hidden lg:inline";
  const short = fullFrom === "xl" ? "xl:hidden" : fullFrom === "sm" ? "sm:hidden" : "lg:hidden";
  const tone = variant === "dark" ? "border-white/20 bg-white/5 text-white/70 backdrop-blur-md hover:bg-white/10 hover:text-white" : "border-line bg-subtle text-muted hover:bg-line hover:text-ink";
  const label = variant === "dark" ? "text-white" : "text-ink";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(ZERO_TOKEN); ok = true; } catch {
      // Fallback for non-secure contexts / older browsers
      const t = document.createElement("textarea");
      t.value = ZERO_TOKEN; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { ok = document.execCommand("copy"); } catch {}
      t.remove();
    }
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title="Copy $ZERO contract address"
      aria-label="Copy $ZERO contract address"
      className={`group inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 font-mono text-xs transition-colors ${tone}`}
    >
      <span className={`font-sans text-[11px] font-semibold tracking-wide ${label}`}>$ZERO</span>
      <span className={full}>{ZERO_TOKEN}</span>
      <span className={short}>{ZERO_TOKEN.slice(0, 6)}…{ZERO_TOKEN.slice(-4)}</span>
      {copied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />}
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}
