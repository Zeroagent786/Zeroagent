import { concat, createPublicClient, formatEther, hexToBytes, http, isHex, keccak256, stringToBytes, toHex, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { SEPOLIA_RPC, USDC_ADDRESS, erc20Abi } from "./contracts";

/* ------------------------------------------------------------------ wallet sources */

export type WalletSource = {
  id: string;
  name: string;
  kind: "evm" | "solana";
  icon?: string;
  /** Connects the wallet and returns a label for the wallet account plus a function that signs one message. */
  connect: () => Promise<{ label: string; sign: (message: string) => Promise<Uint8Array | Hex> }>;
};

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
type SolanaProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (m: Uint8Array, display?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
};
type W = Window & { ethereum?: Eip1193 & { isMetaMask?: boolean; isPhantom?: boolean; providers?: Eip1193[] }; phantom?: { solana?: SolanaProvider; ethereum?: Eip1193 }; solana?: SolanaProvider };

const evmSource = (id: string, name: string, provider: Eip1193, icon?: string): WalletSource => ({
  id, name, kind: "evm", icon,
  connect: async () => {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const from = accounts[0];
    if (!from) throw new Error("No account returned by the wallet");
    return {
      label: from,
      sign: async (message) => (await provider.request({ method: "personal_sign", params: [toHex(stringToBytes(message)), from] })) as Hex,
    };
  },
});

/** Wallets available in this browser: Phantom (Solana + EVM), and anything announcing via EIP-6963 / window.ethereum. */
export function discoverWallets(announced: { info: { uuid: string; name: string; icon: string }; provider: Eip1193 }[]): WalletSource[] {
  const w = window as W;
  const out: WalletSource[] = [];
  const sol = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined);
  if (sol) {
    out.push({
      id: "phantom-solana", name: "Phantom", kind: "solana",
      connect: async () => {
        const { publicKey } = await sol.connect();
        return {
          label: publicKey.toString(),
          sign: async (message) => {
            const r = await sol.signMessage(new TextEncoder().encode(message), "utf8");
            return "signature" in r ? r.signature : r;
          },
        };
      },
    });
  }
  const seen = new Set<string>();
  for (const a of announced) {
    if (seen.has(a.info.uuid)) continue;
    seen.add(a.info.uuid);
    out.push(evmSource(a.info.uuid, a.info.name, a.provider, a.info.icon));
  }
  if (out.filter((s) => s.kind === "evm").length === 0 && w.ethereum) {
    out.push(evmSource("injected", w.ethereum.isMetaMask ? "MetaMask" : w.ethereum.isPhantom ? "Phantom (Ethereum)" : "Browser wallet", w.ethereum));
  }
  return out;
}

/* ------------------------------------------------------------------ derivation */

/**
 * The message the user signs. It is bound to the site's host so a look-alike site asking for the same text would
 * derive a DIFFERENT account and could never reach this one. It is not a transaction and costs nothing.
 */
export const accountMessage = (host: string) =>
  [
    "ZeroAgent: create your account",
    "",
    "Sign this message to create your ZeroAgent account.",
    "",
    "• It is free: no gas, no transaction.",
    "• It cannot move any of your funds.",
    "• Only sign it on " + host + ".",
    "",
    "Account version: 1",
  ].join("\n");

export function deriveKey(signature: Uint8Array | Hex): Hex {
  const bytes = typeof signature === "string" ? (isHex(signature) ? hexToBytes(signature) : stringToBytes(signature)) : signature;
  return keccak256(concat([stringToBytes("zeroagent:account:v1:"), bytes]));
}

/* ------------------------------------------------------------------ store */

export type Status = "idle" | "connecting" | "signing" | "funding" | "ready";
export type AccountState = { status: Status; address?: Hex; label?: string; walletName?: string; error?: string };

const KEY = "zeroagent.account.v1";
const IDLE: AccountState = { status: "idle" };
let state: AccountState = IDLE;
let account: PrivateKeyAccount | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (s: AccountState) => { state = s; emit(); };

export const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
export const getSnapshot = () => state;
export const getServerSnapshot = () => IDLE;
export const getAccount = () => account;

function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as { pk: Hex; label?: string; walletName?: string };
    account = privateKeyToAccount(s.pk);
    state = { status: "ready", address: account.address, label: s.label, walletName: s.walletName };
  } catch { account = null; }
}
if (typeof window !== "undefined") restore();

const publicClient = () => createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });

/** Asks the faucet route for gas + demo USDC, then waits until the balances arrive. Resolves even if funding fails. */
export async function ensureFunded(address: Hex, opts?: { wait?: boolean }): Promise<boolean> {
  const pc = publicClient();
  const funded = async () => {
    const [eth, usdc] = await Promise.all([
      pc.getBalance({ address }),
      pc.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
    ]);
    return eth >= 1_000_000_000_000_000n /* 0.001 ETH */ && usdc > 0n;
  };
  try {
    if (await funded()) return true;
    const res = await fetch("/api/fund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
    if (!res.ok && res.status !== 429) return false;
    if (!opts?.wait) return true;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      if (await funded()) return true;
    }
    return false;
  } catch { return false; }
}

export async function connectWith(source: WalletSource) {
  try {
    set({ status: "connecting", walletName: source.name });
    const { label, sign } = await source.connect();
    set({ status: "signing", walletName: source.name, label });
    const signature = await sign(accountMessage(window.location.host));
    const acct = privateKeyToAccount(deriveKey(signature));
    account = acct;
    try { localStorage.setItem(KEY, JSON.stringify({ pk: deriveKey(signature), label, walletName: source.name })); } catch {}
    set({ status: "funding", address: acct.address, label, walletName: source.name });
    await ensureFunded(acct.address, { wait: true });
    set({ status: "ready", address: acct.address, label, walletName: source.name });
  } catch (e) {
    account = null;
    const msg = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "Connection failed";
    set({ status: "idle", error: /reject|denied|cancel|4001/i.test(msg) ? "You closed the wallet request. Nothing was signed." : msg.slice(0, 200) });
  }
}

export function disconnect() {
  account = null;
  try { localStorage.removeItem(KEY); } catch {}
  set(IDLE);
}

export const clearError = () => { if (state.error) set({ ...state, error: undefined }); };
export const formatEth = (v: bigint) => Number(formatEther(v)).toFixed(4);
