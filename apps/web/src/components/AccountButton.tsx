"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Loader2, LogOut, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Button, Modal, cx } from "./ui";
import { useZeroAccount } from "../hooks/useZeroAccount";
import { discoverWallets, type WalletSource } from "../lib/accountStore";
import { short } from "../lib/format";
import { EXPLORER } from "../lib/contracts";

type Announced = { info: { uuid: string; name: string; icon: string }; provider: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } };

function useWallets(open: boolean) {
  const [wallets, setWallets] = useState<WalletSource[]>([]);
  useEffect(() => {
    if (!open) return;
    const found: Announced[] = [];
    const refresh = () => setWallets(discoverWallets(found));
    const onAnnounce = (e: Event) => { found.push((e as CustomEvent<Announced>).detail); refresh(); };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const t = setTimeout(refresh, 250); // late-injecting wallets (Phantom) register after load
    return () => { window.removeEventListener("eip6963:announceProvider", onAnnounce); clearTimeout(t); };
  }, [open]);
  return wallets;
}

const STEPS = [
  { icon: Wallet, title: "Choose your wallet", body: "Phantom, MetaMask or any wallet, on whatever network it's on." },
  { icon: ShieldCheck, title: "Sign one free message", body: "No gas, no transaction. It can't move your funds." },
  { icon: Sparkles, title: "Your account is ready", body: "We create and fund it for you. No network switching or further pop-ups." },
];

export function ConnectModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { status, error, walletName, connectWith, clearError } = useZeroAccount();
  const wallets = useWallets(open);
  const busy = status === "connecting" || status === "signing" || status === "funding";
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);

  useEffect(() => { if (status === "ready" && open) onOpenChange(false); }, [status, open, onOpenChange]);

  return (
    <Modal open={open} onOpenChange={(o) => { if (!busy) { clearError(); onOpenChange(o); } }} title="Connect to ZeroAgent" description="Create your account in one step.">
      {busy ? (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal" />
          <p className="mt-4 text-sm font-medium">
            {status === "connecting" && `Opening ${walletName}…`}
            {status === "signing" && `Approve the free message in ${walletName}`}
            {status === "funding" && "Setting up and funding your account…"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {status === "signing" ? "This is a signature, not a transaction. It costs nothing." : "This takes a few seconds."}
          </p>
        </div>
      ) : (
        <>
          <ol className="mb-5 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-muted"><s.icon className="h-3.5 w-3.5" /></span>
                <div><p className="text-sm font-medium">{i + 1}. {s.title}</p><p className="text-xs text-muted">{s.body}</p></div>
              </li>
            ))}
          </ol>
          {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-danger break-words">{error}</p>}
          {wallets.length > 0 ? (
            <div className="space-y-2">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => connectWith(w)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-active hover:bg-subtle"
                >
                  {w.icon ? <Image src={w.icon} alt="" width={28} height={28} unoptimized className="rounded-md" /> : <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#AB9FF2] text-xs font-bold text-white">👻</span>}
                  <span className="flex-1 text-sm font-medium">{w.name}{w.kind === "solana" ? <span className="ml-2 text-xs font-normal text-muted">Solana</span> : null}</span>
                  <ChevronDown className="-rotate-90 h-4 w-4 text-muted" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-center">
              <p className="text-sm font-medium">No wallet detected</p>
              <p className="mt-1 text-xs text-muted">Install Phantom or another wallet, then reload this page.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {isMobile && (
                  <a className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-4 text-xs font-medium text-white" href={`https://phantom.app/ul/browse/${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}?ref=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}>
                    Open in Phantom
                  </a>
                )}
                <a className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-4 text-xs font-medium hover:bg-subtle" href="https://phantom.com/download" target="_blank" rel="noreferrer">Get Phantom <ExternalLink className="h-3 w-3" /></a>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function AccountButton({ compact }: { compact?: boolean }) {
  const { status, address, walletName, label, disconnect } = useZeroAccount();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  if (status !== "ready" || !address) {
    return (
      <>
        <Button onClick={() => setOpen(true)} size="md">Connect Wallet</Button>
        <ConnectModal open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setMenu((m) => !m)} className={cx("flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium transition-colors hover:bg-subtle")}>
        <span className="h-2 w-2 rounded-full bg-teal" />
        <span className="font-mono text-xs">{short(address)}</span>
        {!compact && <ChevronDown className="h-3.5 w-3.5 text-muted" />}
      </button>
      {menu && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-pop">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Your ZeroAgent account</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="truncate font-mono text-xs">{address}</span>
              <button aria-label="Copy address" className="text-muted hover:text-ink" onClick={() => { navigator.clipboard?.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
                {copied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">Created from {walletName}{label ? ` · ${short(label)}` : ""}. Runs on the demo network, funded automatically.</p>
            <div className="mt-3 flex flex-col gap-1 border-t border-line pt-2">
              <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-subtle"><ExternalLink className="h-3.5 w-3.5" /> View on explorer</a>
              <Link href="/app" className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-subtle" onClick={() => setMenu(false)}><Wallet className="h-3.5 w-3.5" /> Dashboard</Link>
              <button onClick={() => { setMenu(false); disconnect(); }} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-danger hover:bg-red-50"><LogOut className="h-3.5 w-3.5" /> Disconnect</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
