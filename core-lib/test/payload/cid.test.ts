import { describe, it, expect } from "vitest";
import { CID } from "multiformats/cid";
import { digestToCid, cidToDigest } from "../../src/payload/cid";

describe("cid", () => {
  it("round-trips bytes32 digest ↔ CIDv1", () => {
    const digest = new Uint8Array(32).fill(0xaa);
    const cid = digestToCid(digest);
    expect(CID.parse(cid).toV1().toString()).toBe(cid);
    expect(cidToDigest(cid)).toEqual(digest);
  });
});
