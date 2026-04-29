import { describe, it, expect } from "vitest";
import {
  encodeEnvelope,
  decodeEnvelope,
  tryDecodeEnvelope,
  EnvelopeDecodeError,
} from "../../src/envelope/codec";
import type { Envelope } from "../../src/envelope/schema";

const ZERO_SIG = ("0x" + "00".repeat(65)) as `0x${string}`;
const ZERO_HASH = ("0x" + "00".repeat(32)) as `0x${string}`;

function fixture(overrides: Partial<Envelope> = {}): Envelope {
  return {
    v: 1,
    kind: "agent",
    from: { name: "Alice Bot", owner_url: "https://acme.example", sig: ZERO_SIG },
    title: "build green",
    body: "ready to deploy",
    urgency: "normal",
    sent_at: 1735689600,
    ...overrides,
  } as Envelope;
}

describe("encodeEnvelope / decodeEnvelope", () => {
  it("round-trips a minimal envelope", () => {
    const env = fixture();
    const bytes = encodeEnvelope(env);
    expect(decodeEnvelope(bytes)).toEqual(env);
  });

  it("round-trips an envelope with all optional fields", () => {
    const env = fixture({
      from: {
        name: "Claude Code",
        owner_url: "https://claude.com",
        logo_cid: "bafy...logo",
        uri: "erc8004:taiko:42",
        sig: ZERO_SIG,
      },
      action_url: "https://app.example/approve/123",
      reply_to: ZERO_HASH,
      urgency: "high",
    });
    const bytes = encodeEnvelope(env);
    expect(decodeEnvelope(bytes)).toEqual(env);
  });

  it("round-trips identically regardless of input key order", () => {
    const a = decodeEnvelope(encodeEnvelope(fixture()));
    const b = decodeEnvelope(
      encodeEnvelope({
        sent_at: 1735689600,
        urgency: "normal",
        body: "ready to deploy",
        title: "build green",
        from: { sig: ZERO_SIG, owner_url: "https://acme.example", name: "Alice Bot" },
        kind: "agent",
        v: 1,
      } as Envelope),
    );
    expect(a).toEqual(b);
  });

  it("rejects non-envelope JSON", () => {
    const legacy = new TextEncoder().encode(
      JSON.stringify({ v: 1, kind: "mail", subject: "x", body: { text: "y" } }),
    );
    expect(() => decodeEnvelope(legacy)).toThrow(EnvelopeDecodeError);
    expect(tryDecodeEnvelope(legacy)).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(() => decodeEnvelope(new TextEncoder().encode("not json"))).toThrow(EnvelopeDecodeError);
  });

  it("rejects unsupported version", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...fixture(), v: 2 }));
    expect(() => decodeEnvelope(bytes)).toThrow(/version/);
  });

  it("rejects oversized title", () => {
    expect(() => encodeEnvelope(fixture({ title: "x".repeat(121) }))).toThrow(/title/);
  });

  it("rejects invalid urgency", () => {
    expect(() => encodeEnvelope(fixture({ urgency: "urgent" as never }))).toThrow(/urgency/);
  });

  it("rejects non-https action_url", () => {
    expect(() => encodeEnvelope(fixture({ action_url: "http://insecure" }))).toThrow(/action_url/);
  });

  it("rejects oversized uri", () => {
    expect(() =>
      encodeEnvelope(
        fixture({
          from: { name: "x", owner_url: "https://x", uri: "x".repeat(257), sig: ZERO_SIG },
        }),
      ),
    ).toThrow(/uri/);
  });

  it("rejects non-hex sig", () => {
    expect(() =>
      encodeEnvelope(
        fixture({ from: { name: "x", owner_url: "https://x", sig: "abc" as `0x${string}` } }),
      ),
    ).toThrow(/sig/);
  });
});
