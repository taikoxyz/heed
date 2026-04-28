import { x25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";

export function deriveX25519Private(signature: Uint8Array): Uint8Array {
  if (signature.length < 32) throw new Error("signature too short");
  const seed = sha256(signature);
  const priv = new Uint8Array(seed.slice(0, 32));
  priv[0]! &= 0b11111000;
  priv[31]! &= 0b01111111;
  priv[31]! |= 0b01000000;
  return priv;
}

export function deriveX25519Public(priv: Uint8Array): Uint8Array {
  return x25519.getPublicKey(priv);
}

export const KEY_TYPED_DATA = {
  domain: (chainId: number, contract: `0x${string}`) => ({
    name: "Heed",
    version: "1",
    chainId,
    verifyingContract: contract,
  }),
  types: { Key: [{ name: "keyNonce", type: "uint32" }] } as const,
  primaryType: "Key" as const,
  message: (keyNonce: number) => ({ keyNonce }),
};
