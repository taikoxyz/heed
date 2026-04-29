import { describe, it, expect } from "vitest";
import type { Hex } from "viem";
import { decodePayload } from "../../src/payload/decoded";
import { encodeEnvelope } from "../../src/envelope/codec";
import { encodePlaintext } from "../../src/payload/plaintext";
import type { Envelope } from "../../src/envelope/schema";
import type { PlaintextPayload } from "../../src/types";

const ZERO_SIG = ("0x" + "00".repeat(65)) as Hex;

const ENVELOPE: Envelope = {
  v: 1,
  kind: "agent",
  from: { name: "Bot", owner_url: "https://x", sig: ZERO_SIG },
  title: "t",
  body: "b",
  urgency: "normal",
  sent_at: 1735689600,
};

const MAIL: PlaintextPayload = {
  v: 1,
  kind: "mail",
  from: "0xA" as `0x${string}`,
  to: ["0xB" as `0x${string}`],
  cc: [],
  date: 0,
  msgId: "m",
  subject: "s",
  body: { text: "t" },
  attachments: [],
};

describe("decodePayload", () => {
  it("dispatches an agent envelope to kind=envelope", () => {
    const result = decodePayload(encodeEnvelope(ENVELOPE));
    expect(result.kind).toBe("envelope");
    if (result.kind === "envelope") {
      expect(result.envelope).toEqual(ENVELOPE);
    }
  });

  it("dispatches a mail-shaped payload to kind=mail", () => {
    const result = decodePayload(encodePlaintext(MAIL));
    expect(result.kind).toBe("mail");
    if (result.kind === "mail") {
      expect(result.mail).toEqual(MAIL);
    }
  });

  it("returns kind=unknown for non-matching JSON, preserving the original bytes", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ hello: "world" }));
    const result = decodePayload(bytes);
    expect(result.kind).toBe("unknown");
    if (result.kind === "unknown") {
      expect(result.bytes).toBe(bytes);
    }
  });

  it("returns kind=unknown for non-JSON bytes", () => {
    const bytes = new TextEncoder().encode("not json at all");
    expect(decodePayload(bytes).kind).toBe("unknown");
  });

  it("prefers envelope over mail when both shapes could match", () => {
    const ambiguous = new TextEncoder().encode(
      JSON.stringify({ ...ENVELOPE, kind: "agent" }),
    );
    expect(decodePayload(ambiguous).kind).toBe("envelope");
  });
});
