import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createIndexerMailSource } from "../../src/source/indexer";

const ENDPOINT = "https://api.thegraph.com/subgraphs/name/heed";

const makeRawMail = () => ({
  txHash: "0xabc",
  blockNumber: "1",
  blockTimestamp: "0",
  sender: "0xsender",
  recipient: "0xrecipient",
  contentRef: "0xcr",
  valueGwei: "1",
});

describe("createIndexerMailSource", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listInbox POSTs recipient query and returns mails", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    const raw = makeRawMail();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { mails: [raw] }, errors: undefined }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    const result = await src.listInbox("0xRecipient" as any, undefined, 10);

    expect(result).toHaveLength(1);
    expect(result[0]!.blockNumber).toBe(1n);
    expect(result[0]!.blockTimestamp).toBe(0n);
    expect(result[0]!.valueGwei).toBe(1);
    expect(result[0]!.txHash).toBe("0xabc");

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.variables.r).toBe("0xrecipient");
    expect(body.variables.n).toBe(10);
    expect(body.query).toContain("recipient");
  });

  it("listOutbox POSTs sender query and returns mails", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    const raw = makeRawMail();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { mails: [raw] }, errors: undefined }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    const result = await src.listOutbox("0xSender" as any, undefined, 50);

    expect(result).toHaveLength(1);
    expect(result[0]!.blockNumber).toBe(1n);
    expect(result[0]!.valueGwei).toBe(1);
    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.variables.s).toBe("0xsender");
    expect(body.variables.n).toBe(50);
    expect(body.query).toContain("sender");
  });

  it("getInbox throws with the expected message", async () => {
    const src = createIndexerMailSource(ENDPOINT);
    await expect(src.getInbox("0xAddr" as any)).rejects.toThrow(
      "getInbox via indexer: prefer RPC reader for fresh fee/keys"
    );
  });

  it("subscribe throws with the expected message", () => {
    const src = createIndexerMailSource(ENDPOINT);
    expect(() => src.subscribe("0xAddr" as any, vi.fn())).toThrow(
      "subscribe via indexer requires WS endpoint; impl as poll fallback"
    );
  });

  it("rejects when GraphQL errors field is present", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null, errors: [{ message: "field not found" }] }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    await expect(src.listInbox("0xR" as any)).rejects.toThrow("field not found");
  });

  it("uses default limit of 100 when not specified", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { mails: [] }, errors: undefined }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    await src.listInbox("0xR" as any);
    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.variables.n).toBe(100);
    expect(body.variables.since).toBe("0");
  });

  it("forwards sinceBlock as blockNumber_gte filter", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { mails: [] }, errors: undefined }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    await src.listInbox("0xR" as any, 18000000n, 25);
    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.variables.since).toBe("18000000");
    expect(body.variables.n).toBe(25);
    expect(body.query).toContain("blockNumber_gte");
  });

  it("throws indexer <status> on non-OK HTTP response", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    await expect(src.listInbox("0xR" as any)).rejects.toThrow("indexer 500");
  });

  it("parses string BigInt scalars from subgraph into bigint/number", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          mails: [{
            txHash: "0xdeadbeef",
            blockNumber: "18000000",
            blockTimestamp: "1700000000",
            sender: "0xaaa",
            recipient: "0xbbb",
            contentRef: "0xccc",
            valueGwei: "5000",
          }],
        },
        errors: undefined,
      }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    const result = await src.listInbox("0xbbb" as any);
    const mail = result[0]!;
    expect(mail.blockNumber).toBe(18000000n);
    expect(typeof mail.blockNumber).toBe("bigint");
    expect(mail.blockTimestamp).toBe(1700000000n);
    expect(typeof mail.blockTimestamp).toBe("bigint");
    expect(mail.valueGwei).toBe(5000);
    expect(typeof mail.valueGwei).toBe("number");
  });
});
