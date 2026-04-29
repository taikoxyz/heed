import { describe, it, expect, beforeEach } from "vitest";
import {
  clearResolvers,
  registerDefaultResolvers,
  registerResolver,
  resolveUri,
} from "../src/lib/uri";

beforeEach(() => {
  clearResolvers();
  registerDefaultResolvers();
});

describe("default URI resolvers", () => {
  it("resolves erc8004:<chain>:<id> to a labeled, unverified identity", async () => {
    const r = await resolveUri("erc8004:taiko:42");
    expect(r.source).toBe("erc8004");
    expect(r.display_name).toBe("agent #42 (taiko)");
    expect(r.verified).toBe(false);
  });

  it("resolves erc8004 with hex ids", async () => {
    const r = await resolveUri("erc8004:mainnet:0xabc");
    expect(r.source).toBe("erc8004");
    expect(r.display_name).toBe("agent #0xabc (mainnet)");
  });

  it("resolves https:// to a hostname-labeled identity", async () => {
    const r = await resolveUri("https://claude.com/agents/coding");
    expect(r.source).toBe("https");
    expect(r.display_name).toBe("claude.com");
    expect(r.verified).toBe(false);
  });

  it("returns source=unknown for unrecognized URI schemes", async () => {
    const r = await resolveUri("did:web:example.com");
    expect(r.source).toBe("unknown");
    expect(r.verified).toBe(false);
  });

  it("returns source=unknown for malformed https URIs", async () => {
    const r = await resolveUri("https://[invalid");
    expect(r.source).toBe("unknown");
  });

  it("returns source=unknown for malformed erc8004 URIs", async () => {
    const r = await resolveUri("erc8004:not-a-valid-shape");
    expect(r.source).toBe("unknown");
  });
});

describe("resolver registry", () => {
  it("supports custom resolvers added via registerResolver", async () => {
    registerResolver(
      (u) => u.startsWith("did:"),
      async (u) => ({ raw: u, source: "unknown", display_name: "DID identity", verified: false }),
    );
    const r = await resolveUri("did:web:example.com");
    expect(r.display_name).toBe("DID identity");
  });

  it("falls through to a later matcher when an earlier one rejects", async () => {
    clearResolvers();
    registerResolver(
      (u) => u.startsWith("erc8004:"),
      async (u) => ({ raw: u, source: "erc8004", verified: true }),
    );
    registerResolver(
      () => true,
      async (u) => ({ raw: u, source: "unknown", verified: false }),
    );
    const r = await resolveUri("https://example.com");
    expect(r.source).toBe("unknown");
  });

  it("uses the first matching resolver, not all of them", async () => {
    clearResolvers();
    registerResolver(
      () => true,
      async (u) => ({ raw: u, source: "https", display_name: "first", verified: false }),
    );
    registerResolver(
      () => true,
      async (u) => ({ raw: u, source: "https", display_name: "second", verified: false }),
    );
    const r = await resolveUri("anything");
    expect(r.display_name).toBe("first");
  });
});
