import { describe, it, expect, vi } from "vitest";
import { createRpcMailSource } from "../../src/source/rpc";

const DEAD_CONTRACT = "0x000000000000000000000000000000000000dead" as const;

describe("createRpcMailSource", () => {
  it("returns an object satisfying the MailSource interface", () => {
    const fakeClient = {
      getLogs: vi.fn(),
      watchEvent: vi.fn(),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    expect(typeof src.listInbox).toBe("function");
    expect(typeof src.listOutbox).toBe("function");
    expect(typeof src.getInbox).toBe("function");
    expect(typeof src.subscribe).toBe("function");
  });

  it("maps logs to MailEvent[] for listInbox", async () => {
    const fakeLog = {
      transactionHash: "0xabc",
      blockNumber: 1n,
      args: { sender: "0xS", recipient: "0xR", contentRef: "0xCR", valueGwei: 5n },
    };
    const fakeClient = {
      getLogs: vi.fn(async () => [fakeLog]),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listInbox("0xR" as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.txHash).toBe("0xabc");
    expect(result[0]?.sender).toBe("0xS");
    expect(result[0]?.valueGwei).toBe(5);
    expect(result[0]?.blockTimestamp).toBe(0n);
  });

  it("maps logs to MailEvent[] for listOutbox", async () => {
    const fakeLog = {
      transactionHash: "0xdef",
      blockNumber: 2n,
      args: { sender: "0xAlice", recipient: "0xBob", contentRef: "0xREF", valueGwei: 10n },
    };
    const fakeClient = {
      getLogs: vi.fn(async () => [fakeLog]),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listOutbox("0xAlice" as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.txHash).toBe("0xdef");
    expect(result[0]?.recipient).toBe("0xBob");
    expect(result[0]?.valueGwei).toBe(10);
  });

  it("passes sinceBlock and applies limit via slice", async () => {
    const logs = Array.from({ length: 5 }, (_, i) => ({
      transactionHash: `0x${i}`,
      blockNumber: BigInt(i),
      args: { sender: "0xS", recipient: "0xR", contentRef: "0xCR", valueGwei: BigInt(i) },
    }));
    const fakeClient = {
      getLogs: vi.fn(async () => logs),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listInbox("0xR" as any, 10n, 3);
    expect(result).toHaveLength(3);
    const [, init] = fakeClient.getLogs.mock.calls[0]!;
    expect(fakeClient.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 10n })
    );
  });

  it("subscribe calls watchEvent and returns unsubscribe fn", () => {
    const unwatch = vi.fn();
    const fakeClient = {
      getLogs: vi.fn(),
      watchEvent: vi.fn(() => unwatch),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const unsub = src.subscribe("0xR" as any, vi.fn());
    expect(fakeClient.watchEvent).toHaveBeenCalledOnce();
    expect(unsub).toBe(unwatch);
  });
});
