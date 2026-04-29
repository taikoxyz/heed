import { describe, it, expect } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import {
  encodeEncryptedBytes,
  decodeEncryptedBytes,
  encodeEncrypted,
  decodeEncrypted,
} from "../../src/payload/encrypted";
import { encodeEnvelope, decodeEnvelope } from "../../src/envelope/codec";
import type { Envelope } from "../../src/envelope/schema";
import type { Hex } from "viem";

const ZERO_SIG = ("0x" + "00".repeat(65)) as Hex;

describe("encodeEncryptedBytes / decodeEncryptedBytes", () => {
  it("round-trips arbitrary bytes through lockbox encryption", () => {
    const sk = x25519.utils.randomPrivateKey();
    const pk = x25519.getPublicKey(sk);
    const inner = new TextEncoder().encode("anything goes here");
    const wire = encodeEncryptedBytes(inner, [
      { rcpt: "0xB" as `0x${string}`, keyNonce: 7, pub: pk },
    ]);
    const recovered = decodeEncryptedBytes(wire, {
      rcpt: "0xB" as `0x${string}`,
      keyNonce: 7,
      sk,
    });
    expect(recovered).toEqual(inner);
  });

  it("composes with envelope codec for the full agent send-receive flow", () => {
    const sk = x25519.utils.randomPrivateKey();
    const pk = x25519.getPublicKey(sk);
    const env: Envelope = {
      v: 1,
      kind: "agent",
      from: { name: "Bot", owner_url: "https://x", sig: ZERO_SIG },
      title: "deploy?",
      body: "ready when you are",
      urgency: "high",
      sent_at: 1735689600,
    };
    const innerBytes = encodeEnvelope(env);
    const wire = encodeEncryptedBytes(innerBytes, [
      { rcpt: "0xB" as `0x${string}`, keyNonce: 1, pub: pk },
    ]);
    const decryptedBytes = decodeEncryptedBytes(wire, {
      rcpt: "0xB" as `0x${string}`,
      keyNonce: 1,
      sk,
    });
    expect(decodeEnvelope(decryptedBytes)).toEqual(env);
  });

  it("does not break the existing PlaintextPayload-typed wrapper", () => {
    const sk = x25519.utils.randomPrivateKey();
    const pk = x25519.getPublicKey(sk);
    const mail = {
      v: 1 as const,
      kind: "mail" as const,
      from: "0xA" as `0x${string}`,
      to: ["0xB" as `0x${string}`],
      cc: [] as `0x${string}`[],
      date: 0,
      msgId: "x",
      subject: "s",
      body: { text: "t" },
      attachments: [],
    };
    const wire = encodeEncrypted(mail, [
      { rcpt: "0xB" as `0x${string}`, keyNonce: 5, pub: pk },
    ]);
    expect(
      decodeEncrypted(wire, { rcpt: "0xB" as `0x${string}`, keyNonce: 5, sk }),
    ).toEqual(mail);
  });
});
