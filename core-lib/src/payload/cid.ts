import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { create as createDigest } from "multiformats/hashes/digest";

export const DAG_PB_CODE = 0x70;
export const RAW_CODE = raw.code;

const ACCEPTED_CODECS = new Set<number>([RAW_CODE, DAG_PB_CODE]);

export function digestToCid(
  digest: Uint8Array,
  codec: number = DAG_PB_CODE,
): string {
  if (digest.length !== 32) throw new Error("expected 32-byte sha256 digest");
  if (!ACCEPTED_CODECS.has(codec)) throw new Error("unsupported codec");
  return CID.create(1, codec, createDigest(sha256.code, digest)).toString();
}

export function cidToDigest(cidStr: string): Uint8Array {
  const cid = CID.parse(cidStr);
  if (
    cid.version !== 1 ||
    !ACCEPTED_CODECS.has(cid.code) ||
    cid.multihash.code !== sha256.code
  ) {
    throw new Error("unexpected CID shape");
  }
  return cid.multihash.digest;
}
