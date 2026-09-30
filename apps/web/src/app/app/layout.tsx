"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Fuel, LayoutDashboard, TerminalSquare, Users } from "lucide-react";
import { AccountButton } from "../../components/AccountButton";
import { useBalance } from "wagmi";
import { useAccount } from "../../hooks/useZeroAccount";
import { formatEther } from "viem";
import { Logo } from "../../components/Logo";
import { XIcon } from "../../components/XIcon";
import { X_HANDLE, X_URL } from "../../lib/links";
import { cx } from "../../components/ui";
import { CHAIN_ID } from "../../lib/contracts";
import { NETWORK_LABEL } from "../../lib/network";
import { requestIntro } from "../../components/Splash";

const NAV = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Agents", href: "/app/agents", icon: Users },
  { name: "Jobs", href: "/app/jobs", icon: Briefcase },
  { name: "Playground", href: "/app/playground", icon: TerminalSquare },
];

function NetworkSelect() {
  return (
    <div className="hidden sm:flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-xs font-medium">
      <span className="h-2 w-2 rounded-full bg-teal" />
      {NETWORK_LABEL}
    </div>
  );
}

function GasTank() {
  const { address } = useAccount();
  const { data } = useBalance({ address, chainId: CHAIN_ID, query: { enabled: !!address, refetchInterval: 5_000 } });
  if (!address) return null;
  const eth = data ? Number(formatEther(data.value)) : null;
  return (
    <div
      title="Gas tank: your ETH balance"
      className={cx(
        "hidden md:flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium tabular-nums",
        eth !== null && eth < 0.005 ? "border-amber/40 bg-amber/10 text-amber" : "border-line bg-surface"
      )}
    >
      <Fuel className="h-3.5 w-3.5 text-muted" />
      {eth === null ? "…" : `${eth.toFixed(4)} ETH`}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <div className="flex h-dvh bg-canvas">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="h-16 flex items-center px-5 border-b border-line">
          <Link href="/" aria-label="ZeroAgent, back to start" onClick={requestIntro}>
            <Logo size={28} />
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href) ? "bg-subtle text-ink" : "text-muted hover:text-ink hover:bg-subtle/70"
              )}
            >
              <item.icon className={cx("h-4 w-4", isActive(item.href) ? "text-brand" : "")} />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ZeroAgent on X"
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:text-ink hover:bg-subtle/70 transition-colors"
          >
            <XIcon className="h-3.5 w-3.5" /> Follow us on X
            <span className="ml-auto text-[10px] text-muted/80">{X_HANDLE}</span>
          </a>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 flex items-center justify-between gap-3 px-4 md:px-8 border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-20">
          <Link href="/" className="md:hidden" aria-label="ZeroAgent, back to start" onClick={requestIntro}>
            <Logo size={28} label={false} />
          </Link>
          <div className="hidden md:block text-sm text-muted">
            {NAV.find((n) => isActive(n.href))?.name}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NetworkSelect />
            <GasTank />
            <AccountButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scroll-thin px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-10">
          <div className="mx-auto max-w-6xl animate-rise">{children}</div>
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-surface/95 backdrop-blur border-t border-line flex justify-around">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx("flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium", isActive(item.href) ? "text-ink" : "text-muted")}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
