import { createPublicClient, http, type PublicClient } from "viem";
import { taiko } from "viem/chains";
import { resolveUri, type ResolvedIdentity } from "./uri";

const clients = new Map<string, PublicClient>();
const cache = new Map<string, Promise<ResolvedIdentity>>();

function clientFor(rpcUrl: string): PublicClient {
  let c = clients.get(rpcUrl);
  if (!c) {
    c = createPublicClient({ chain: taiko, transport: http(rpcUrl) });
    clients.set(rpcUrl, c);
  }
  return c;
}

export function resolveIdentity(uri: string, rpcUrl: string): Promise<ResolvedIdentity> {
  const key = `${rpcUrl}\n${uri}`;
  let p = cache.get(key);
  if (!p) {
    p = resolveUri(uri, { client: clientFor(rpcUrl) });
    cache.set(key, p);
  }
  return p;
}
