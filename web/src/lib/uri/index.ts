import { matchErc8004, resolveErc8004 } from "./erc8004";
import { matchHttps, resolveHttps } from "./https";
import type {
  ResolvedIdentity,
  UriMatcher,
  UriResolver,
  UriResolverContext,
} from "./types";

interface RegisteredResolver {
  match: UriMatcher;
  resolve: UriResolver;
}

const registry: RegisteredResolver[] = [];

export function registerResolver(
  match: UriMatcher,
  resolve: UriResolver,
): void {
  registry.push({ match, resolve });
}

export async function resolveUri(
  uri: string,
  ctx?: UriResolverContext,
): Promise<ResolvedIdentity> {
  for (const r of registry) {
    if (r.match(uri)) return r.resolve(uri, ctx);
  }
  return { raw: uri, source: "unknown", verified: false };
}

export function clearResolvers(): void {
  registry.length = 0;
}

export function registerDefaultResolvers(): void {
  registerResolver(matchErc8004, resolveErc8004);
  registerResolver(matchHttps, resolveHttps);
}

registerDefaultResolvers();

export type {
  ResolvedIdentity,
  UriMatcher,
  UriResolver,
  UriResolverContext,
} from "./types";
