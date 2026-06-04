import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { resolveUri, type ResolvedIdentity } from "./uri";

const clients = new Map<string, PublicClient>();
const cache = new Map<string, Promise<ResolvedIdentity>>();

function clientFor(chain: Chain, rpcUrl: string): PublicClient {
  const key = `${chain.id}\n${rpcUrl}`;
  let c = clients.get(key);
  if (!c) {
    c = createPublicClient({ chain, transport: http(rpcUrl) });
    clients.set(key, c);
  }
  return c;
}

export function resolveIdentity(
  uri: string,
  rpcUrl: string,
  chain: Chain,
): Promise<ResolvedIdentity> {
  const key = `${chain.id}\n${rpcUrl}\n${uri}`;
  let p = cache.get(key);
  if (!p) {
    p = resolveUri(uri, { client: clientFor(chain, rpcUrl) });
    cache.set(key, p);
  }
  return p;
}
