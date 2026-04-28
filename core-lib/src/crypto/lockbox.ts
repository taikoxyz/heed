import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes, concatBytes } from "@noble/hashes/utils";

export interface RecipientKey {
  rcpt: string;
  keyNonce: number;
  pub: Uint8Array;
}

export interface DecryptKey {
  rcpt: string;
  keyNonce: number;
  sk: Uint8Array;
}

export interface EncryptedEnvelope {
  v: 1;
  scheme: 1;
  nonce: string;
  lockboxes: Array<{ rcpt: string; keyNonce: number; wrapped: string }>;
  ct: string;
}

const INFO = new TextEncoder().encode("heed.lockbox.v1");

export function encryptForRecipients(
  plaintext: Uint8Array,
  rcpts: RecipientKey[],
): EncryptedEnvelope {
  const contentKey = randomBytes(32);
  const ctNonce = randomBytes(24);
  const ct = xchacha20poly1305(contentKey, ctNonce).encrypt(plaintext);

  const lockboxes = rcpts.map((r) => {
    const ephSk = x25519.utils.randomPrivateKey();
    const ephPub = x25519.getPublicKey(ephSk);
    const shared = x25519.getSharedSecret(ephSk, r.pub);
    const wrapKey = hkdf(sha256, shared, concatBytes(ephPub, r.pub), INFO, 32);
    const kxNonce = randomBytes(24);
    const wrappedCk = xchacha20poly1305(wrapKey, kxNonce).encrypt(contentKey);
    const wrapped = concatBytes(ephPub, kxNonce, wrappedCk);
    return { rcpt: r.rcpt, keyNonce: r.keyNonce, wrapped: toB64(wrapped) };
  });

  return { v: 1, scheme: 1, nonce: toB64(ctNonce), lockboxes, ct: toB64(ct) };
}

export function decryptForRecipient(env: EncryptedEnvelope, k: DecryptKey): Uint8Array {
  const lb = env.lockboxes.find((l) => l.rcpt === k.rcpt && l.keyNonce === k.keyNonce);
  if (!lb) throw new Error("no lockbox for recipient/keyNonce");
  const wrapped = fromB64(lb.wrapped);
  const ephPub = wrapped.slice(0, 32);
  const kxNonce = wrapped.slice(32, 56);
  const wrappedCk = wrapped.slice(56);
  const shared = x25519.getSharedSecret(k.sk, ephPub);
  const ourPub = x25519.getPublicKey(k.sk);
  const wrapKey = hkdf(sha256, shared, concatBytes(ephPub, ourPub), INFO, 32);
  const contentKey = xchacha20poly1305(wrapKey, kxNonce).decrypt(wrappedCk);
  return xchacha20poly1305(contentKey, fromB64(env.nonce)).decrypt(fromB64(env.ct));
}

function toB64(b: Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}
