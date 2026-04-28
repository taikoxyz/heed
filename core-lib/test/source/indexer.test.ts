import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createIndexerMailSource } from "../../src/source/indexer";

const ENDPOINT = "https://api.thegraph.com/subgraphs/name/heed";

const makeMail = () => ({
  txHash: "0xabc",
  blockNumber: 1n,
  blockTimestamp: 0n,
  sender: "0xsender",
  recipient: "0xrecipient",
  contentRef: "0xcr",
  valueGwei: 1,
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
    const mail = makeMail();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { mails: [mail] }, errors: undefined }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    const result = await src.listInbox("0xRecipient" as any, undefined, 10);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mail);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.variables.r).toBe("0xrecipient");
    expect(body.variables.n).toBe(10);
    expect(body.query).toContain("recipient");
  });

  it("listOutbox POSTs sender query and returns mails", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    const mail = makeMail();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { mails: [mail] }, errors: undefined }),
    } as Response);

    const src = createIndexerMailSource(ENDPOINT);
    const result = await src.listOutbox("0xSender" as any, undefined, 50);

    expect(result).toHaveLength(1);
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
  });
});
