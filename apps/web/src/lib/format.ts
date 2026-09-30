import { formatUnits } from "viem";
import { USDC_DECIMALS } from "./contracts";

export const short = (a: string, l = 6, r = 4) => `${a.slice(0, l)}…${a.slice(-r)}`;

export const usdc = (v: bigint) => {
  const n = Number(formatUnits(v, USDC_DECIMALS));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

export const timeAgo = (unixSeconds: number) => {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

/** "in 3h" / "2h ago" for any unix timestamp. */
export const relTime = (unixSeconds: number) => {
  const d = unixSeconds - Math.floor(Date.now() / 1000);
  const a = Math.abs(d);
  const v = a < 60 ? `${a}s` : a < 3600 ? `${Math.floor(a / 60)}m` : a < 86400 ? `${Math.floor(a / 3600)}h` : `${Math.floor(a / 86400)}d`;
  return d >= 0 ? `in ${v}` : `${v} ago`;
};

export const fmtDate =(unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const FRIENDLY: Record<string, string> = {
  SelfDealing: "You can't hire an agent that you own.",
  NameTaken: "That agent name is already taken.",
  NameTooLong: "Agent name is too long (max 64 characters).",
  TokenNotAllowed: "That payment token is not supported.",
  NotClient: "Only the task's client can do this.",
  NotAgentOwner: "Only the agent's owner can do this.",
  InvalidStatus: "This task isn't in the right state for that action.",
  AgentInactive: "That agent is currently inactive.",
  DeadlinePassed: "The deadline for this task has passed.",
  DeadlineNotPassed: "The deadline hasn't passed yet.",
  ReviewWindowOpen: "The client's review window is still open.",
  ReviewWindowClosed: "The review window has closed.",
  MustClaimOwnAccount: "You can only claim your own account.",
  AlreadyRegistered: "This account is already claimed.",
  NotRootOwner: "Only the account's root owner can do this.",
  AlreadyRated: "You already rated this task.",
  insufficient: "Your account is out of gas. It will be topped up automatically, try again in a moment.",
};

export const errMsg = (e: unknown) => {
  const x = e as { shortMessage?: string; message?: string; cause?: { data?: { errorName?: string } } };
  const raw = `${x.shortMessage ?? ""} ${x.message ?? ""}`;
  for (const [k, v] of Object.entries(FRIENDLY)) if (raw.includes(k)) return v;
  const m = x.shortMessage ?? x.message ?? "Unknown error";
  return m.length > 240 ? m.slice(0, 240) + "…" : m;
};
