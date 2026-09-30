"use client";

import { useSyncExternalStore } from "react";
import { clearError, connectWith, disconnect, getAccount, getServerSnapshot, getSnapshot, subscribe } from "../lib/accountStore";

/** The user's derived ZeroAgent account (created from one free wallet signature). */
export function useZeroAccount() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...s, account: s.status === "ready" || s.status === "funding" ? getAccount() : null, connectWith, disconnect, clearError };
}

/** Drop-in for wagmi's useAccount so pages keep the same shape. */
export function useAccount() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = s.status === "ready";
  return { address: ready ? s.address : undefined, isConnected: ready };
}
