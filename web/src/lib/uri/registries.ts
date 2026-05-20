import type { Abi } from "viem";

// Minimal ERC-8004 identity registry ABI.
// Assumption: the registry exposes a view that maps an agent id to its record.
// We model the canonical ERC-8004 IdentityRegistry `getAgent(uint256)` returning
// (address owner, string agentURI). A non-zero owner is treated as a verified claim.
export const ERC8004_REGISTRY_ABI = [
  {
    type: "function",
    name: "getAgent",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "agentURI", type: "string" },
    ],
  },
] as const satisfies Abi;

// Registry contract addresses keyed by the URI <chain> token.
// Empty by default: no registry is assumed for any chain. Populate this map to
// enable on-chain ERC-8004 verification.
export const ERC8004_REGISTRIES: Record<string, `0x${string}`> = {};
