import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCid } from "../../src/ipfs/gateway";

describe("fetchCid", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns bytes on successful fetch", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    const data = new Uint8Array([10, 20, 30]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => data.buffer,
    } as Response);

    const result = await fetchCid("Qmfoo", "https://gw.example.com");
    expect(result).toEqual(data);
  });

  it("throws gateway <status> on 404", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchCid("Qmbad", "https://gw.example.com")).rejects.toThrow("gateway 404");
  });

  it("normalizes trailing slash on gatewayUrl", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    } as Response);

    await fetchCid("QmCID", "https://gw.example.com/");

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://gw.example.com/ipfs/QmCID");
  });

  it("works without trailing slash on gatewayUrl", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([2]).buffer,
    } as Response);

    await fetchCid("QmCID2", "https://gw.example.com");

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://gw.example.com/ipfs/QmCID2");
  });
});
