import { describe, it, expect } from "vitest";
import { resolveIdentity } from "../src/lib/identity";

describe("resolveIdentity", () => {
  it("returns the same cached promise for a repeat (uri, rpc)", () => {
    const a = resolveIdentity("erc8004:taiko:1", "http://rpc.test");
    const b = resolveIdentity("erc8004:taiko:1", "http://rpc.test");
    expect(a).toBe(b);
  });

  it("resolves an erc8004 uri to an unverified identity when no registry is configured", async () => {
    const r = await resolveIdentity("erc8004:taiko:7", "http://rpc.test");
    expect(r.source).toBe("erc8004");
    expect(r.verified).toBe(false);
    expect(r.display_name).toBe("agent #7 (taiko)");
  });
});
