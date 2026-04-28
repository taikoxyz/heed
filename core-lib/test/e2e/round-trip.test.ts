import { describe, it, expect } from "vitest";
import { sha256 } from "@noble/hashes/sha256";
import { deriveX25519Private, deriveX25519Public } from "../../src/crypto/key-derivation";
import { encodeEncrypted, decodeEncrypted } from "../../src/payload/encrypted";
import { digestToCid, cidToDigest } from "../../src/payload/cid";
import type { PlaintextPayload } from "../../src/types";

describe("e2e: derive → encrypt → cid → decrypt", () => {
  it("round-trips an encrypted mail end-to-end", () => {
    const bobSig = new Uint8Array(65).fill(0x77);
    const bobSk = deriveX25519Private(bobSig);
    const bobPk = deriveX25519Public(bobSk);

    const payload: PlaintextPayload = {
      v: 1,
      kind: "mail",
      from: "0x000000000000000000000000000000000000aaaa",
      to: ["0x000000000000000000000000000000000000bbbb"],
      cc: [],
      date: 1735689600,
      msgId: "e2e-1",
      subject: "hi bob",
      body: { text: "hello from alice" },
      attachments: [],
    };

    const ciphertextBytes = encodeEncrypted(payload, [
      { rcpt: payload.to[0]!, keyNonce: 7, pub: bobPk },
    ]);

    const digest = sha256(ciphertextBytes);
    const cid = digestToCid(digest);

    const recoveredDigest = cidToDigest(cid);
    expect(recoveredDigest).toEqual(digest);

    const bobSkAgain = deriveX25519Private(bobSig);
    expect(bobSkAgain).toEqual(bobSk);

    const decoded = decodeEncrypted(ciphertextBytes, {
      rcpt: payload.to[0]!,
      keyNonce: 7,
      sk: bobSkAgain,
    });

    expect(decoded).toEqual(payload);
  });

  it("recipient with wrong keyNonce cannot decrypt", () => {
    const bobSig = new Uint8Array(65).fill(0x33);
    const bobSk = deriveX25519Private(bobSig);
    const bobPk = deriveX25519Public(bobSk);

    const payload: PlaintextPayload = {
      v: 1, kind: "mail",
      from: "0x000000000000000000000000000000000000aaaa",
      to: ["0x000000000000000000000000000000000000bbbb"],
      cc: [], date: 0, msgId: "e2e-2",
      subject: "x", body: { text: "y" }, attachments: [],
    };

    const ciphertextBytes = encodeEncrypted(payload, [
      { rcpt: payload.to[0]!, keyNonce: 5, pub: bobPk },
    ]);

    expect(() =>
      decodeEncrypted(ciphertextBytes, { rcpt: payload.to[0]!, keyNonce: 6, sk: bobSk }),
    ).toThrow();
  });
});
