import { describe, it, expect } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import { encryptForRecipients, decryptForRecipient } from "../../src/crypto/lockbox";

describe("lockbox", () => {
  it("encrypts to N recipients and each can decrypt independently", () => {
    const aliceSk = x25519.utils.randomPrivateKey();
    const alicePk = x25519.getPublicKey(aliceSk);
    const bobSk = x25519.utils.randomPrivateKey();
    const bobPk = x25519.getPublicKey(bobSk);

    const plaintext = new TextEncoder().encode("hello taiko");
    const env = encryptForRecipients(plaintext, [
      { rcpt: "0xAAA", keyNonce: 0, pub: alicePk },
      { rcpt: "0xBBB", keyNonce: 3, pub: bobPk },
    ]);

    expect(env.lockboxes.length).toBe(2);
    expect(decryptForRecipient(env, { rcpt: "0xAAA", keyNonce: 0, sk: aliceSk })).toEqual(plaintext);
    expect(decryptForRecipient(env, { rcpt: "0xBBB", keyNonce: 3, sk: bobSk })).toEqual(plaintext);
  });

  it("rejects tampered ciphertext (AEAD tag mismatch)", () => {
    const aliceSk = x25519.utils.randomPrivateKey();
    const alicePk = x25519.getPublicKey(aliceSk);
    const plaintext = new TextEncoder().encode("hello taiko");
    const env = encryptForRecipients(plaintext, [
      { rcpt: "0xAAA", keyNonce: 0, pub: alicePk },
    ]);

    const ctBytes = new Uint8Array(Buffer.from(env.ct, "base64"));
    ctBytes[0] = ctBytes[0]! ^ 0x01;
    const tampered = { ...env, ct: Buffer.from(ctBytes).toString("base64") };

    expect(() =>
      decryptForRecipient(tampered, { rcpt: "0xAAA", keyNonce: 0, sk: aliceSk }),
    ).toThrow();
  });

  it("throws when no lockbox matches recipient/keyNonce", () => {
    const aliceSk = x25519.utils.randomPrivateKey();
    const alicePk = x25519.getPublicKey(aliceSk);
    const plaintext = new TextEncoder().encode("hello taiko");
    const env = encryptForRecipients(plaintext, [
      { rcpt: "0xAAA", keyNonce: 0, pub: alicePk },
    ]);

    expect(() =>
      decryptForRecipient(env, { rcpt: "0xCCC", keyNonce: 0, sk: aliceSk }),
    ).toThrow("no lockbox for recipient/keyNonce");
  });
});
