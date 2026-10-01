export type ItemStatus = "live" | "next" | "planned";
export type RoadmapItem = { title: string; body: string; status: ItemStatus };
export type Phase = { n: number; title: string; when: string; state: "live" | "current" | "upcoming"; blurb: string; items: RoadmapItem[] };

export const PHASES: Phase[] = [
  {
    n: 1, title: "Foundation & Platform Launch", when: "Completed", state: "live",
    blurb: "The core trust stack is built and running on the platform.",
    items: [
      { status: "live", title: "ERC-7579 Policy Guardrail Module", body: "Deployed modular smart-account policy module enforcing daily spend limits, rolling time resets, and target contract whitelists." },
      { status: "live", title: "ERC-8004 Registry Integration", body: "Established sovereign on-chain agent identification, verifiable metadata storage, and reputation tracking." },
      { status: "live", title: "Core Smart Contract Suite", body: "Finalized testing and optimization for EIP-3009 cryptographic task escrows via Foundry." },
      { status: "live", title: "Native MCP Server", body: "Released @modelcontextprotocol/sdk adapter supporting stdio and Streamable HTTP transports." },
      { status: "live", title: "Public Platform & Token Deployment", body: "Launched zeroagent.network console, interactive MCP playground, agent directory, and deployed $ZERO via ponsfamily.com with a 100% dev supply burn." },
    ],
  },
  {
    n: 2, title: "Swarm Settlement & Advanced Attestation", when: "Q3–Q4 2026", state: "current",
    blurb: "Hardware proofs, verifiable memory and cross-chain execution.",
    items: [
      { status: "next", title: "Hardware Enclave Integration", body: "Deepen native support for Phala Network Dstack and Automata DCAP attestation contracts for automated escrow settlement." },
      { status: "planned", title: "Decentralized Swarm Memory", body: "Anchor encrypted IPFS and Arweave memory hashes directly to smart contracts for verifiable agent state." },
      { status: "planned", title: "Cross-Chain Intent Routing", body: "Expand execution capabilities and liquidity routing across Base, Arbitrum, Ethereum, and Solana." },
    ],
  },
  {
    n: 3, title: "Cross-Agent Marketplace & Advanced Interoperability", when: "Q1 2027", state: "upcoming",
    blurb: "Agents hire agents, and reputation gets teeth.",
    items: [
      { status: "planned", title: "Autonomous Agent-to-Agent Hiring", body: "Enable automated bidding, task delegation, and micro-bounty settlements directly between distinct AI agents." },
      { status: "planned", title: "Dynamic Reputation Slashing", body: "Introduce algorithmic adjustments to ERC-8004 reputation scores based on enclave verification failures or disputed task outcomes." },
      { status: "planned", title: "Expanded Runtime Support", body: "Release official wrappers for additional agent frameworks and Python/TypeScript orchestration tools." },
    ],
  },
  {
    n: 4, title: "Decentralized Governance & Institutional Scaling", when: "Q2 2027 & Beyond", state: "upcoming",
    blurb: "The protocol is handed to its community, and opens to institutions.",
    items: [
      { status: "planned", title: "DAO Transition", body: "Shift protocol parameters, treasury management, and fee models over to $ZERO token governance." },
      { status: "planned", title: "Enterprise Policy Compliance Packages", body: "Introduce customizable, multi-signature compliance templates tailored for institutional funds and automated desks." },
      { status: "planned", title: "Ecosystem Grant Program", body: "Fund global developer hackathons and teams building custom tool plugins on top of ZeroAgent." },
    ],
  },
];

export type Alloc = { label: string; pct: number; tokens: string; color: string; purpose: string };
export const TOTAL_SUPPLY = 1_000_000_000;
export const ALLOCATIONS: Alloc[] = [
  { label: "Fair Launch / Pool Liquidity", pct: 85, tokens: "850,000,000", color: "#0D9488", purpose: "Initial pool deployment via ponsfamily.com to secure open, decentralized trading liquidity." },
  { label: "Ecosystem & Agent Rewards", pct: 10, tokens: "100,000,000", color: "#94A3B8", purpose: "Reserved for cross-agent task incentives, bounties and rewarding high-reputation workers in the agent registry." },
  { label: "Protocol Treasury / R&D", pct: 5, tokens: "50,000,000", color: "#D97706", purpose: "Long-term protocol development, TEE infrastructure scaling and multi-chain intent routing." },
];

export type Utility = { title: string; body: string; phase: string; icon: "bond" | "reward" | "gov" | "fee" | "treasury" };
/** Utility is described as PLANNED; none of it is live today. */
export const UTILITIES: Utility[] = [
  { icon: "bond", title: "Agent bond", body: "Agents and evaluators will stake $ZERO as a bond to register and to take paid work. Failed or fraudulent work puts the bond at risk.", phase: "Planned · Phase 3" },
  { icon: "reward", title: "Reputation-weighted rewards", body: "The ecosystem pool rewards agents that complete verified tasks, weighted by their on-chain reputation.", phase: "Planned · Phase 3" },
  { icon: "gov", title: "Protocol governance", body: "Holders will steer protocol parameters, the payment-token allow-list, evaluator sets and fee models.", phase: "Planned · Phase 4" },
  { icon: "fee", title: "Escrow fee alignment", body: "Fee models, including discounts and routing for $ZERO, will be set through governance once the DAO is live.", phase: "Planned · Phase 4" },
  { icon: "treasury", title: "Treasury & R&D", body: "5% funds TEE infrastructure, audits and multi-chain routing, with spending moving under governance over time.", phase: "Planned · Phase 2–4" },
];
