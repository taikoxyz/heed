import { describe, it, expect } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import { encodePlaintext, decodePlaintext } from "../../src/payload/plaintext";
import { encodeEncrypted, decodeEncrypted } from "../../src/payload/encrypted";

describe("plaintext payload", () => {
  it("round-trips JSON shape", () => {
    const p = {
      v: 1 as const, kind: "mail" as const,
      from: "0xA" as `0x${string}`, to: ["0xB" as `0x${string}`], cc: [] as `0x${string}`[], date: 1735689600,
      msgId: "abc", subject: "hi", body: { text: "hello" }, attachments: [],
    };
    const bytes = encodePlaintext(p);
    expect(decodePlaintext(bytes)).toEqual(p);
  });
});

describe("encrypted payload", () => {
  it("round-trips with single recipient", () => {
    const sk = x25519.utils.randomPrivateKey();
    const pk = x25519.getPublicKey(sk);
    const p: any = {
      v: 1, kind: "mail", from: "0xA", to: ["0xB"], cc: [], date: 0,
      msgId: "x", subject: "s", body: { text: "t" }, attachments: [],
    };
    const bytes = encodeEncrypted(p, [{ rcpt: "0xB", keyNonce: 5, pub: pk }]);
    expect(decodeEncrypted(bytes, { rcpt: "0xB", keyNonce: 5, sk })).toEqual(p);
  });
});
