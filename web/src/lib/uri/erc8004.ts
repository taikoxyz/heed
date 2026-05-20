import { getContract } from "viem";
import type { UriMatcher, UriResolver } from "./types";
import { ERC8004_REGISTRIES, ERC8004_REGISTRY_ABI } from "./registries";

const PATTERN = /^erc8004:([a-z0-9-]+):([0-9]+|0x[0-9a-fA-F]+)$/;

export const matchErc8004: UriMatcher = (uri) => PATTERN.test(uri);

export const resolveErc8004: UriResolver = async (uri, ctx) => {
  const m = uri.match(PATTERN);
  if (!m) return { raw: uri, source: "unknown", verified: false };
  const [, chain, id] = m;
  const label = `agent #${id} (${chain})`;

  const registries = ctx?.registries ?? ERC8004_REGISTRIES;
  const registry = registries[chain];
  if (!ctx?.client || !registry) {
    return {
      raw: uri,
      source: "erc8004",
      display_name: label,
      description: "ERC-8004 agent identity. No registry configured for this chain; identity claim is unverified.",
      registry_url: registry,
      verified: false,
    };
  }

  try {
    const contract = getContract({ address: registry, abi: ERC8004_REGISTRY_ABI, client: ctx.client });
    const [owner, agentURI] = (await contract.read.getAgent([BigInt(id)])) as [`0x${string}`, string];
    const registered = owner !== "0x0000000000000000000000000000000000000000";
    if (!registered) {
      return {
        raw: uri,
        source: "erc8004",
        display_name: label,
        description: "ERC-8004 registry has no record for this agent id; identity claim is unverified.",
        verified: false,
      };
    }
    return {
      raw: uri,
      source: "erc8004",
      display_name: label,
      description: "ERC-8004 agent identity verified against the on-chain registry.",
      owner,
      registry_url: agentURI || registry,
      verified: true,
    };
  } catch {
    return {
      raw: uri,
      source: "erc8004",
      display_name: label,
      description: "ERC-8004 registry lookup failed; identity claim is unverified.",
      registry_url: registry,
      verified: false,
    };
  }
};
