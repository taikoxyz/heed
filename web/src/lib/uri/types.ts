export interface ResolvedIdentity {
  raw: string;
  source: "erc8004" | "https" | "unknown";
  display_name?: string;
  description?: string;
  owner?: string;
  registry_url?: string;
  verified: boolean;
}

export type UriMatcher = (uri: string) => boolean;
export type UriResolver = (uri: string) => Promise<ResolvedIdentity>;
