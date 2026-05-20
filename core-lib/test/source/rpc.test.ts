import { describe, it, expect, vi } from "vitest";
import { createRpcMailSource } from "../../src/source/rpc";

const DEAD_CONTRACT = "0x000000000000000000000000000000000000dead" as const;

const fakeBlock = (n: bigint, ts: bigint) => ({ number: n, timestamp: ts });

describe("createRpcMailSource", () => {
  it("returns an object satisfying the MailSource interface", () => {
    const fakeClient = {
      getLogs: vi.fn(),
      watchEvent: vi.fn(),
      getBlock: vi.fn(),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    expect(typeof src.listInbox).toBe("function");
    expect(typeof src.listOutbox).toBe("function");
    expect(typeof src.getInbox).toBe("function");
    expect(typeof src.subscribe).toBe("function");
  });

  it("maps logs to MailEvent[] for listInbox with real block timestamps", async () => {
    const fakeLog = {
      transactionHash: "0xabc",
      blockNumber: 1n,
      args: { sender: "0xS", recipient: "0xR", contentRef: "0xCR", valueGwei: 5n },
    };
    const fakeClient = {
      getLogs: vi.fn(async () => [fakeLog]),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, 1700000000n)),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listInbox("0xR" as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.txHash).toBe("0xabc");
    expect(result[0]?.sender).toBe("0xS");
    expect(result[0]?.valueGwei).toBe(5);
    expect(result[0]?.blockTimestamp).toBe(1700000000n);
  });

  it("maps logs to MailEvent[] for listOutbox", async () => {
    const fakeLog = {
      transactionHash: "0xdef",
      blockNumber: 2n,
      args: { sender: "0xAlice", recipient: "0xBob", contentRef: "0xREF", valueGwei: 10n },
    };
    const fakeClient = {
      getLogs: vi.fn(async () => [fakeLog]),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, 1700000002n)),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listOutbox("0xAlice" as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.txHash).toBe("0xdef");
    expect(result[0]?.recipient).toBe("0xBob");
    expect(result[0]?.valueGwei).toBe(10);
    expect(result[0]?.blockTimestamp).toBe(1700000002n);
  });

  it("listInbox passes sinceBlock and limit and returns descending array", async () => {
    const logs = Array.from({ length: 5 }, (_, i) => ({
      transactionHash: `0x${i}`,
      blockNumber: BigInt(i),
      args: { sender: "0xS", recipient: "0xR", contentRef: "0xCR", valueGwei: BigInt(i) },
    }));
    const fakeClient = {
      getLogs: vi.fn(async () => logs),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, blockNumber * 10n)),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listInbox("0xR" as any, 10n, 3);
    expect(result).toHaveLength(3);
    expect(fakeClient.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 10n })
    );
    expect(result.map((m) => m.blockNumber)).toEqual([4n, 3n, 2n]);
  });

  it("listInboxPage passes sinceBlock, applies limit via slice, returns descending order with cursor", async () => {
    const logs = Array.from({ length: 5 }, (_, i) => ({
      transactionHash: `0x${i}`,
      blockNumber: BigInt(i),
      args: { sender: "0xS", recipient: "0xR", contentRef: "0xCR", valueGwei: BigInt(i) },
    }));
    const fakeClient = {
      getLogs: vi.fn(async () => logs),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, blockNumber * 10n)),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { sinceBlock: 10n, limit: 3 });
    expect(items).toHaveLength(3);
    expect(fakeClient.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 10n })
    );
    expect(items.map((m) => m.blockNumber)).toEqual([4n, 3n, 2n]);
    expect(nextCursor).toBe(2n);
  });

  it("listInboxPage pages with before cursor (toBlock = before-1) and stops when fully drained", async () => {
    const logs = [
      { transactionHash: "0x1", blockNumber: 1n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 1n } },
      { transactionHash: "0x2", blockNumber: 2n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 2n } },
    ];
    const fakeClient = {
      getLogs: vi.fn(async () => logs),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, blockNumber)),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { before: 5n, limit: 10 });
    expect(fakeClient.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ toBlock: 4n })
    );
    expect(items.map((m) => m.blockNumber)).toEqual([2n, 1n]);
    expect(nextCursor).toBeUndefined();
  });

  it("listInboxPage short-circuits when before cursor is at or below deployedAtBlock", async () => {
    const fakeClient = {
      getLogs: vi.fn(),
      getBlock: vi.fn(),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 100n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { before: 100n });
    expect(items).toEqual([]);
    expect(nextCursor).toBeUndefined();
    expect(fakeClient.getLogs).not.toHaveBeenCalled();
  });

  it("listInboxPage does not split a block across pages", async () => {
    // block 2 holds three events; with limit 2 the page must still return all of
    // block 2 (not just the newest event in it), so the next page can't skip them.
    const logs = [
      { transactionHash: "0xa", blockNumber: 1n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 1n } },
      { transactionHash: "0xb", blockNumber: 2n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 2n } },
      { transactionHash: "0xc", blockNumber: 2n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 3n } },
      { transactionHash: "0xd", blockNumber: 2n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 4n } },
      { transactionHash: "0xe", blockNumber: 3n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 5n } },
    ];
    const fakeClient = {
      getLogs: vi.fn(async () => logs),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, blockNumber)),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { limit: 2 });
    expect(items.map((m) => m.blockNumber)).toEqual([3n, 2n, 2n, 2n]);
    expect(nextCursor).toBe(2n);
  });

  it("dedupes getBlock calls per unique block number", async () => {
    const logs = [
      { transactionHash: "0x1", blockNumber: 5n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 1n } },
      { transactionHash: "0x2", blockNumber: 5n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 2n } },
      { transactionHash: "0x3", blockNumber: 6n, args: { sender: "0xS", recipient: "0xR", contentRef: "0xC", valueGwei: 3n } },
    ];
    const fakeClient = {
      getLogs: vi.fn(async () => logs),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, blockNumber)),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    await src.listInbox("0xR" as any);
    expect(fakeClient.getBlock).toHaveBeenCalledTimes(2);
  });

  it("subscribe calls watchEvent and returns unsubscribe fn", () => {
    const unwatch = vi.fn();
    const fakeClient = {
      getLogs: vi.fn(),
      watchEvent: vi.fn(() => unwatch),
      getBlock: vi.fn(),
      readContract: vi.fn(),
    } as any;
    const src = createRpcMailSource({ client: fakeClient, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const unsub = src.subscribe("0xR" as any, vi.fn());
    expect(fakeClient.watchEvent).toHaveBeenCalledOnce();
    expect(unsub).toBe(unwatch);
  });
});
