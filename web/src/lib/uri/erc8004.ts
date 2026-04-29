import type { UriMatcher, UriResolver } from "./types";

const PATTERN = /^erc8004:([a-z0-9-]+):([0-9]+|0x[0-9a-fA-F]+)$/;

export const matchErc8004: UriMatcher = (uri) => PATTERN.test(uri);

export const resolveErc8004: UriResolver = async (uri) => {
  const m = uri.match(PATTERN);
  if (!m) return { raw: uri, source: "unknown", verified: false };
  const [, chain, id] = m;
  return {
    raw: uri,
    source: "erc8004",
    display_name: `agent #${id} (${chain})`,
    description: "ERC-8004 agent identity. Registry lookup not yet performed; identity claim is unverified.",
    verified: false,
  };
};
