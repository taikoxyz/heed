import { describe, it, expect } from "vitest";
import type { MailEvent } from "@heed/core";
import {
  DB_VERSION,
  decodeMailEvent,
  encodeMailEvent,
  parseImport,
  serializeExport,
} from "../src/lib/db";
import { EMPTY_SETTINGS } from "../src/lib/settings";

const sampleEvent: MailEvent = {
  txHash: `0x${"a".repeat(64)}`,
  blockNumber: 12345678901234567890n,
  blockTimestamp: 1716200000n,
  sender: `0x${"1".repeat(40)}`,
  recipient: `0x${"2".repeat(40)}`,
  contentRef: "0xdeadbeef",
  valueGwei: 7,
};

const emptyStores = { messages: [], decoded: [], flags: [], drafts: [] };

describe("MailEvent bigint codec", () => {
  it("round-trips bigint fields without loss", () => {
    const json = encodeMailEvent(sampleEvent);
    expect(typeof json.blockNumber).toBe("string");
    expect(typeof json.blockTimestamp).toBe("string");
    expect(decodeMailEvent(json)).toEqual(sampleEvent);
  });

  it("preserves a value larger than Number.MAX_SAFE_INTEGER", () => {
    const json = encodeMailEvent(sampleEvent);
    expect(json.blockNumber).toBe("12345678901234567890");
    expect(decodeMailEvent(json).blockNumber).toBe(12345678901234567890n);
  });
});

describe("export serialization", () => {
  it("stamps the backup header", () => {
    const out = serializeExport(emptyStores, EMPTY_SETTINGS);
    expect(out.app).toBe("heed");
    expect(out.schemaVersion).toBe(DB_VERSION);
    expect(out.enc).toBe(false);
    expect(typeof out.exportedAt).toBe("string");
  });

  it("round-trips through parseImport", () => {
    const out = serializeExport(
      {
        ...emptyStores,
        messages: [
          {
            id: "x",
            scope: "s",
            chainId: 1,
            account: "0xabc",
            direction: "received",
            event: encodeMailEvent(sampleEvent),
          },
        ],
      },
      EMPTY_SETTINGS,
    );
    const parsed = parseImport(JSON.stringify(out));
    expect(parsed.app).toBe("heed");
    expect(parsed.stores.messages).toHaveLength(1);
    expect(decodeMailEvent(parsed.stores.messages[0].event)).toEqual(
      sampleEvent,
    );
  });
});

describe("parseImport validation", () => {
  it("rejects a file that is not a Heed backup", () => {
    expect(() => parseImport(JSON.stringify({ app: "other" }))).toThrow();
  });

  it("rejects a newer schema version", () => {
    expect(() =>
      parseImport(
        JSON.stringify({ app: "heed", schemaVersion: DB_VERSION + 1 }),
      ),
    ).toThrow();
  });

  it("defaults missing stores to empty arrays", () => {
    const parsed = parseImport(
      JSON.stringify({ app: "heed", schemaVersion: DB_VERSION }),
    );
    expect(parsed.stores).toEqual(emptyStores);
    expect(parsed.settings).toEqual(EMPTY_SETTINGS);
  });
});
