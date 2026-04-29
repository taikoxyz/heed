import { describe, it, expect } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import { hexToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deriveAgentKeys, generatePrivateKey } from "../../src/lib/derive";

const PK: Hex = `0x${"1".repeat(64)}`;
const CONTRACT = "0x08f32278B2CFD962444ae9541122eD84cc745678" as const;
const CHAIN_ID = 167000;

describe("deriveAgentKeys", () => {
  it("returns the address derived from the wallet private key", async () => {
    const expected = privateKeyToAccount(PK).address;
    const keys = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID, contract: CONTRACT, keyNonce: 0 });
    expect(keys.address).toBe(expected);
  });

  it("derives a 32-byte X25519 private key + matching public key", async () => {
    const keys = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID, contract: CONTRACT, keyNonce: 0 });
    expect(keys.encryptionPriv.length).toBe(32);
    expect(keys.encryptionPub).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(hexToBytes(keys.encryptionPub)).toEqual(x25519.getPublicKey(keys.encryptionPriv));
  });

  it("is deterministic given the same wallet + chain + contract + nonce", async () => {
    const a = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID, contract: CONTRACT, keyNonce: 0 });
    const b = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID, contract: CONTRACT, keyNonce: 0 });
    expect(b.encryptionPub).toBe(a.encryptionPub);
    expect(b.encryptionPriv).toEqual(a.encryptionPriv);
  });

  it("produces a different encryption key when the keyNonce changes", async () => {
    const k0 = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID, contract: CONTRACT, keyNonce: 0 });
    const k1 = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID, contract: CONTRACT, keyNonce: 1 });
    expect(k1.encryptionPub).not.toBe(k0.encryptionPub);
  });

  it("produces a different encryption key when the chain or contract changes (domain separation)", async () => {
    const baseline = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID, contract: CONTRACT, keyNonce: 0 });
    const otherChain = await deriveAgentKeys({ privateKey: PK, chainId: CHAIN_ID + 1, contract: CONTRACT, keyNonce: 0 });
    const otherContract = await deriveAgentKeys({
      privateKey: PK,
      chainId: CHAIN_ID,
      contract: "0x0000000000000000000000000000000000000001",
      keyNonce: 0,
    });
    expect(otherChain.encryptionPub).not.toBe(baseline.encryptionPub);
    expect(otherContract.encryptionPub).not.toBe(baseline.encryptionPub);
  });
});

describe("generatePrivateKey", () => {
  it("returns 0x-prefixed 64-char hex", () => {
    expect(generatePrivateKey()).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("returns distinct values across calls", () => {
    expect(generatePrivateKey()).not.toBe(generatePrivateKey());
  });
});
