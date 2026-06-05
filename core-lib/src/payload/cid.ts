import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { create as createDigest } from "multiformats/hashes/digest";

// Canonical on-wire CID: CIDv1, raw codec, sha256-256 (heed-design.md §IPFS).
export function digestToCid(digest: Uint8Array): string {
  if (digest.length !== 32) throw new Error("expected 32-byte sha256 digest");
  return CID.create(1, raw.code, createDigest(sha256.code, digest)).toString();
}

export function cidToDigest(cidStr: string): Uint8Array {
  const cid = CID.parse(cidStr);
  if (
    cid.version !== 1 ||
    cid.code !== raw.code ||
    cid.multihash.code !== sha256.code
  ) {
    throw new Error("unexpected CID shape");
  }
  return cid.multihash.digest;
}
