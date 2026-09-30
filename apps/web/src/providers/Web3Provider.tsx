"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { SEPOLIA_RPC } from "../lib/contracts";
import { ToastProvider } from "../components/Toast";

// Wagmi is used for chain READS only. Writes come from the user's derived ZeroAgent account (see lib/accountStore).
export const config = createConfig({
  chains: [sepolia],
  transports: { [sepolia.id]: http(SEPOLIA_RPC) },
  ssr: true,
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 8_000, refetchOnWindowFocus: false, retry: 1 } } })
  );
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
