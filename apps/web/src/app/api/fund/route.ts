import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, parseAbi, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { SEPOLIA_RPC, USDC_ADDRESS } from "../../../lib/contracts";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const GAS_DROP = parseEther("0.006"); // ~a full session of actions at Sepolia gas prices
const GAS_LOW = parseEther("0.0025");
const TOKEN_DROP = 10_000n * 10n ** 6n;
const TOKEN_LOW = 100n * 10n ** 6n;
const FAUCET_RESERVE = parseEther("0.005");
const abi = parseAbi(["function balanceOf(address) view returns (uint256)", "function mint(address to, uint256 amount)"]);

// Best-effort abuse guard (per server instance): 40 funded requests / IP / hour (shared venue Wi-Fi friendly),
// 150 drops / hour overall, and a 90 s cool-down per address so in-flight drops are never duplicated.
const hits = new Map<string, number[]>();
const lastDrop = new Map<string, number>();
let global: number[] = [];
const recent = (arr: number[]) => arr.filter((t) => Date.now() - t < 3_600_000);

export async function POST(req: Request) {
  const key = process.env.FAUCET_PRIVATE_KEY;
  if (!key) return NextResponse.json({ error: "Account setup is temporarily unavailable." }, { status: 503 });

  let address: string | undefined;
  try { address = ((await req.json()) as { address?: string }).address; } catch {}
  if (!address || !isAddress(address)) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const mine = recent(hits.get(ip) ?? []);
  global = recent(global);
  if (mine.length >= 40 || global.length >= 150) return NextResponse.json({ error: "Too many requests, try again shortly." }, { status: 429 });

  const addrKey = address.toLowerCase();
  if (Date.now() - (lastDrop.get(addrKey) ?? 0) < 90_000) return NextResponse.json({ ok: true, pending: true });

  const faucet = privateKeyToAccount(key as `0x${string}`);
  const pc = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
  const wc = createWalletClient({ account: faucet, chain: sepolia, transport: http(SEPOLIA_RPC) });

  try {
    const [eth, tok, faucetEth] = await Promise.all([
      pc.getBalance({ address }),
      pc.readContract({ address: USDC_ADDRESS, abi, functionName: "balanceOf", args: [address] }),
      pc.getBalance({ address: faucet.address }),
    ]);
    const needEth = eth < GAS_LOW;
    const needTok = tok < TOKEN_LOW;
    if (!needEth && !needTok) return NextResponse.json({ ok: true, funded: true });
    if (needEth && faucetEth < GAS_DROP + FAUCET_RESERVE) return NextResponse.json({ error: "Account setup is busy, please try again later." }, { status: 503 });

    mine.push(Date.now()); hits.set(ip, mine); global.push(Date.now()); lastDrop.set(addrKey, Date.now());
    const sent: Record<string, string> = {};
    if (needEth) sent.eth = await wc.sendTransaction({ to: address, value: GAS_DROP });
    if (needTok) sent.token = await wc.writeContract({ address: USDC_ADDRESS, abi, functionName: "mint", args: [address, TOKEN_DROP] });
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    return NextResponse.json({ error: (e as { shortMessage?: string }).shortMessage ?? "Funding failed" }, { status: 500 });
  }
}
