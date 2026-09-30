"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { createWalletClient, http, type Abi, type Address, type TransactionReceipt } from "viem";
import { sepolia } from "viem/chains";
import { SEPOLIA_RPC } from "../lib/contracts";
import { errMsg } from "../lib/format";
import { useToast } from "../components/Toast";
import { ensureFunded, getAccount } from "../lib/accountStore";
import { useZeroAccount } from "./useZeroAccount";

type WriteParams = { address: Address; abi: Abi | readonly unknown[]; functionName: string; args?: readonly unknown[] };

/**
 * Sends a contract write from the user's ZeroAgent account: no wallet pop-up and no network switching.
 * pending toast -> receipt -> success/error toast. Resolves to the receipt, or null when it failed.
 */
export function useTx() {
  const { status } = useZeroAccount();
  const publicClient = usePublicClient();
  const qc = useQueryClient();
  const toast = useToast();

  return async (label: string, params: WriteParams, opts?: { silentSuccess?: boolean }): Promise<TransactionReceipt | null> => {
    const account = getAccount();
    if (status !== "ready" || !account) {
      toast.push({ kind: "error", title: "Connect your wallet first", body: "Use the Connect button to create your ZeroAgent account." });
      return null;
    }
    const id = toast.push({ kind: "pending", title: label, body: "Submitting…" });
    try {
      await ensureFunded(account.address, { wait: true });
      const wallet = createWalletClient({ account, chain: sepolia, transport: http(SEPOLIA_RPC) });
      const hash = await wallet.writeContract(params as unknown as Parameters<typeof wallet.writeContract>[0]);
      toast.update(id, { body: "Waiting for confirmation…", tx: hash });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain");
      toast.update(id, { kind: "success", title: `${label} — confirmed`, body: undefined, tx: hash });
      if (opts?.silentSuccess) toast.dismiss(id);
      await qc.invalidateQueries();
      return receipt;
    } catch (e) {
      toast.update(id, { kind: "error", title: `${label} — failed`, body: errMsg(e) });
      return null;
    }
  };
}
