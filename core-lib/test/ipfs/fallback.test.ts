import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCidWithFallback } from "../../src/ipfs/gateway";

describe("fetchCidWithFallback", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the second gateway when the first fails", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    const data = new Uint8Array([7, 8, 9]);
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => data.buffer,
      } as Response);

    const result = await fetchCidWithFallback(
      "Qmfoo",
      ["https://gw1.example.com", "https://gw2.example.com"],
      { retries: 0 },
    );

    expect(result).toEqual(data);
    expect(mockFetch.mock.calls[0]![0]).toBe(
      "https://gw1.example.com/ipfs/Qmfoo",
    );
    expect(mockFetch.mock.calls[1]![0]).toBe(
      "https://gw2.example.com/ipfs/Qmfoo",
    );
  });

  it("retries a transient failure before moving on", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    const data = new Uint8Array([1]);
    mockFetch
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => data.buffer,
      } as Response);

    const result = await fetchCidWithFallback(
      "Qmbar",
      ["https://gw1.example.com"],
      {
        retries: 1,
        backoffMs: 0,
      },
    );

    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws when all gateways fail", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue({ ok: false, status: 502 } as Response);

    const promise = fetchCidWithFallback(
      "Qmbad",
      ["https://gw1.example.com", "https://gw2.example.com/"],
      { retries: 0 },
    );

    await expect(promise).rejects.toThrow("all gateways failed");
    await expect(promise).rejects.toThrow("https://gw1.example.com/ipfs/Qmbad");
    await expect(promise).rejects.toThrow("https://gw2.example.com/ipfs/Qmbad");
  });

  it("throws when no gateways are configured", async () => {
    await expect(fetchCidWithFallback("Qmx", [])).rejects.toThrow(
      "no gateways configured",
    );
  });
});
