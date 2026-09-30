import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import "./globals.css";
import AmbientBackground from "../components/AmbientBackground";
import { Web3Provider } from "../providers/Web3Provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const brand = Syne({ variable: "--font-brand", subsets: ["latin"], weight: ["600"] });

export const metadata: Metadata = {
  title: "ZeroAgent | Verifiable, Policy-Gated On-Chain Agents",
  description:
    "The trust, safety and settlement OS for autonomous AI agents: ERC-7579 policy firewalls, ERC-8004 identity and reputation, and cryptographic task escrows.",
  openGraph: {
    title: "ZeroAgent | Verifiable, Policy-Gated On-Chain Agents",
    description:
      "The trust, safety and settlement OS for autonomous AI agents: ERC-7579 policy firewalls, ERC-8004 identity and reputation, and cryptographic task escrows.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ZeroAgent" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@zeroagentnet",
    title: "ZeroAgent | Verifiable, Policy-Gated On-Chain Agents",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${brand.variable} h-full`}>
      <body className="min-h-full flex flex-col text-ink antialiased selection:bg-[#E4E4E7]">
        <AmbientBackground />
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
