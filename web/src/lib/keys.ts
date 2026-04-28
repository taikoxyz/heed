import { deriveX25519Private } from "@heed/core";

const cache = new Map<string, Uint8Array>();

export function getCachedKey(address: string, nonce: number) {
  return cache.get(cacheKey(address, nonce));
}

export function putKey(
  address: string,
  nonce: number,
  sigHex: `0x${string}`,
) {
  const sk = deriveX25519Private(hexToBytes(sigHex));
  cache.set(cacheKey(address, nonce), sk);
  return sk;
}

export function clearKeys() {
  cache.clear();
}

export function evictKey(address: string, nonce: number) {
  cache.delete(cacheKey(address, nonce));
}

function cacheKey(address: string, nonce: number) {
  return `${address.toLowerCase()}:${nonce}`;
}

function hexToBytes(h: string) {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
