import { describe, it, expect } from "vitest";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { create as createDigest } from "multiformats/hashes/digest";
import { digestToCid, cidToDigest } from "../../src/payload/cid";

describe("cid", () => {
  it("round-trips bytes32 digest ↔ CIDv1", () => {
    const digest = new Uint8Array(32).fill(0xaa);
    const cid = digestToCid(digest);
    expect(CID.parse(cid).toV1().toString()).toBe(cid);
    expect(cidToDigest(cid)).toEqual(digest);
  });

  it("rejects CIDs whose multihash is not sha256", () => {
    const blake2b256Code = 0xb220;
    const digest = new Uint8Array(32).fill(0xbb);
    const cid = CID.create(1, raw.code, createDigest(blake2b256Code, digest)).toString();
    expect(() => cidToDigest(cid)).toThrow("unexpected CID shape");
  });
});
