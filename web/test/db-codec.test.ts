import { describe, it, expect } from "vitest";
import type { MailEvent } from "@heed/core";
import { unzipSync, zipSync, strFromU8 } from "fflate";
import {
  DB_VERSION,
  EXPORT_FORMAT,
  decodeMailEvent,
  encodeMailEvent,
  parseImport,
  parseImportFile,
  parseImportZip,
  serializeExport,
  serializeExportZip,
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

describe("zip export serialization", () => {
  const messageRecord = {
    id: "1:0xabc:received:0xtx",
    scope: "1:0xabc:received",
    chainId: 1,
    account: "0xabc",
    direction: "received" as const,
    event: encodeMailEvent(sampleEvent),
  };
  const decodedRecord = {
    contentRef: "0xdeadbeef",
    payload: {
      kind: "envelope" as const,
      envelope: {
        v: 1 as const,
        kind: "agent" as const,
        from: {
          name: "ACME",
          owner_url: "https://acme.example",
          sig: "0x00" as const,
        },
        title: "hi",
        body: "hello",
        urgency: "normal" as const,
        sent_at: 1716200000,
      },
    },
    decodedAt: 1716200000000,
  };

  it("writes the documented layout with one decoded file per record", () => {
    const bytes = serializeExportZip(
      {
        messages: [messageRecord],
        decoded: [decodedRecord],
        flags: [],
        drafts: [],
      },
      EMPTY_SETTINGS,
    );
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual(
      [
        "decoded/0xdeadbeef.json",
        "drafts.json",
        "flags.json",
        "manifest.json",
        "messages.json",
        "settings.json",
      ].sort(),
    );
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    expect(manifest.app).toBe("heed");
    expect(manifest.schemaVersion).toBe(DB_VERSION);
    expect(manifest.exportFormat).toBe(EXPORT_FORMAT);
  });

  it("round-trips through parseImportZip", () => {
    const bytes = serializeExportZip(
      {
        messages: [messageRecord],
        decoded: [decodedRecord],
        flags: [],
        drafts: [],
      },
      EMPTY_SETTINGS,
    );
    const parsed = parseImportZip(bytes);
    expect(parsed.app).toBe("heed");
    expect(parsed.stores.messages).toHaveLength(1);
    expect(parsed.stores.decoded).toEqual([decodedRecord]);
    expect(decodeMailEvent(parsed.stores.messages[0].event)).toEqual(
      sampleEvent,
    );
  });

  it("rejects a zip without manifest.json", () => {
    const bytes = serializeExportZip(emptyStores, EMPTY_SETTINGS);
    const entries = unzipSync(bytes);
    delete entries["manifest.json"];
    expect(() => parseImportZip(zipSync(entries))).toThrow(/manifest/i);
  });
});

describe("parseImportFile auto-detect", () => {
  function fileOf(bytes: Uint8Array, name: string): File {
    return new File([bytes], name);
  }

  it("imports a zip backup", async () => {
    const bytes = serializeExportZip(emptyStores, EMPTY_SETTINGS);
    const parsed = await parseImportFile(fileOf(bytes, "backup.zip"));
    expect(parsed.app).toBe("heed");
  });

  it("imports a legacy JSON backup", async () => {
    const json = JSON.stringify(serializeExport(emptyStores, EMPTY_SETTINGS));
    const parsed = await parseImportFile(
      fileOf(new TextEncoder().encode(json), "backup.json"),
    );
    expect(parsed.app).toBe("heed");
  });

  it("rejects unrecognized content", async () => {
    await expect(
      parseImportFile(fileOf(new TextEncoder().encode("nope"), "x")),
    ).rejects.toThrow();
  });
});
