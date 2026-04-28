import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pin } from "../../src/ipfs/pinata";

describe("pin", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns IpfsHash on success", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ IpfsHash: "Qmfoo123" }),
    } as Response);

    const result = await pin(new Uint8Array([1, 2, 3]), "test.bin", { jwt: "myjwt" });
    expect(result).toBe("Qmfoo123");
  });

  it("throws pinata <status> on non-OK response", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    await expect(pin(new Uint8Array([1]), "f.bin", { jwt: "tok" })).rejects.toThrow("pinata 500");
  });

  it("sends Authorization header with JWT", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ IpfsHash: "QmBar" }),
    } as Response);

    await pin(new Uint8Array([9]), "x.bin", { jwt: "secret-token" });

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer secret-token");
  });
});
