import { describe, it, expect } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import { deriveX25519Private, deriveX25519Public } from "../../src/crypto/key-derivation";

describe("key derivation", () => {
  it("is deterministic given the same signature", () => {
    const sig = new Uint8Array(65).fill(0xab);
    const priv1 = deriveX25519Private(sig);
    const priv2 = deriveX25519Private(sig);
    expect(priv1).toEqual(priv2);
  });

  it("derives a 32-byte clamped scalar from a 65-byte signature", () => {
    const sig = new Uint8Array(65).fill(0x42);
    const priv = deriveX25519Private(sig);
    expect(priv.length).toBe(32);
    expect(priv[0]! & 0b00000111).toBe(0);
    expect((priv[31]! & 0b11000000)).toBe(0b01000000);
  });

  it("derives a public key that matches @noble/curves x25519.getPublicKey", () => {
    const sig = new Uint8Array(65).fill(0x99);
    const priv = deriveX25519Private(sig);
    const ourPub = deriveX25519Public(priv);
    expect(ourPub).toEqual(x25519.getPublicKey(priv));
  });
});
