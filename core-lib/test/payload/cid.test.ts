import { describe, it, expect } from "vitest";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { create as createDigest } from "multiformats/hashes/digest";
import { digestToCid, cidToDigest } from "../../src/payload/cid";

const DAG_PB_CODE = 0x70;

describe("cid", () => {
  it("round-trips bytes32 digest ↔ CIDv1 raw codec (bafkrei…)", () => {
    const digest = new Uint8Array(32).fill(0xaa);
    const cid = digestToCid(digest);
    expect(cid.startsWith("bafkrei")).toBe(true);
    expect(CID.parse(cid).code).toBe(raw.code);
    expect(cidToDigest(cid)).toEqual(digest);
  });

  it("rejects dag-pb CIDs — raw is the only accepted codec", () => {
    const digest = new Uint8Array(32).fill(0xab);
    const cid = CID.create(
      1,
      DAG_PB_CODE,
      createDigest(sha256.code, digest),
    ).toString();
    expect(() => cidToDigest(cid)).toThrow("unexpected CID shape");
  });

  it("rejects CIDs whose multihash is not sha256", () => {
    const blake2b256Code = 0xb220;
    const digest = new Uint8Array(32).fill(0xbb);
    const cid = CID.create(
      1,
      raw.code,
      createDigest(blake2b256Code, digest),
    ).toString();
    expect(() => cidToDigest(cid)).toThrow("unexpected CID shape");
  });
});
