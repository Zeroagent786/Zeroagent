"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";
import { XIcon } from "./XIcon";
import { ContractChip } from "./ContractChip";
import { X_URL } from "../lib/links";

const LINKS: [string, string][] = [
  ["/#how", "How it works"],
  ["/#features", "Features"],
  ["/roadmap", "Roadmap"],
  ["/tokenomics", "Tokenomics"],
];

/** Sticky top bar shared by the landing page and the public info pages. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 md:px-8">
        <Link href="/" aria-label="ZeroAgent, back to start" className="shrink-0">
          <span className="sm:hidden"><Logo label={false} /></span>
          <span className="hidden sm:inline"><Logo /></span>
        </Link>
        <nav className="hidden xl:flex items-center gap-7 whitespace-nowrap text-sm font-medium text-muted">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="transition-colors hover:text-ink">{label}</Link>
          ))}
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
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted md:flex-row md:px-8">
        <Logo size={24} />
        <nav className="flex items-center gap-6">
          <Link href="/roadmap" className="hover:text-ink">Roadmap</Link>
          <Link href="/tokenomics" className="hover:text-ink">Tokenomics</Link>
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink">X</a>
        </nav>
        <p>© {new Date().getFullYear()} ZeroAgent</p>
      </div>
    </footer>
  );
}
