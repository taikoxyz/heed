import { describe, it, expect, vi } from "vitest";
import { createRpcMailSource } from "../../src/source/rpc";

const DEAD_CONTRACT = "0x000000000000000000000000000000000000dead" as const;

const fakeBlock = (n: bigint, ts: bigint) => ({ number: n, timestamp: ts });

interface FakeLog {
  transactionHash: string;
  blockNumber: bigint;
  args: { sender: string; recipient: string; contentRef: string; valueGwei: bigint };
}

function log(block: number, idx: number, over: Partial<FakeLog["args"]> = {}): FakeLog {
  return {
    transactionHash: `0x${block}_${idx}`,
    blockNumber: BigInt(block),
    args: { sender: "0xS", recipient: "0xR", contentRef: "0xCR", valueGwei: BigInt(idx), ...over },
  };
}

// A fake viem client that honours the fromBlock/toBlock window (so windowed
// paging behaves realistically) and reports a chain tip via getBlockNumber.
function fakeClient(logs: FakeLog[], opts: { tip?: bigint } = {}) {
  const tip = opts.tip ?? logs.reduce((m, l) => (l.blockNumber > m ? l.blockNumber : m), 0n);
  return {
    getBlockNumber: vi.fn(async () => tip),
    getLogs: vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock?: bigint }) =>
      logs.filter((l) => l.blockNumber >= fromBlock && (toBlock === undefined || l.blockNumber <= toBlock)),
    ),
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => fakeBlock(blockNumber, blockNumber * 10n)),
    watchEvent: vi.fn(),
    readContract: vi.fn(),
  } as any;
}

describe("createRpcMailSource", () => {
  it("returns an object satisfying the MailSource interface", () => {
    const src = createRpcMailSource({ client: fakeClient([]), contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    expect(typeof src.listInbox).toBe("function");
    expect(typeof src.listOutbox).toBe("function");
    expect(typeof src.listInboxPage).toBe("function");
    expect(typeof src.listOutboxPage).toBe("function");
    expect(typeof src.getInbox).toBe("function");
    expect(typeof src.subscribe).toBe("function");
  });

  it("maps logs to MailEvent[] for listInbox with real block timestamps", async () => {
    const client = fakeClient([log(1, 0, { valueGwei: 5n })]);
    client.getBlock = vi.fn(async () => fakeBlock(1n, 1700000000n));
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listInbox("0xR" as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.txHash).toBe("0x1_0");
    expect(result[0]?.sender).toBe("0xS");
    expect(result[0]?.valueGwei).toBe(5);
    expect(result[0]?.blockTimestamp).toBe(1700000000n);
  });

  it("maps logs to MailEvent[] for listOutbox", async () => {
    const client = fakeClient([log(2, 0, { sender: "0xAlice", recipient: "0xBob", valueGwei: 10n })]);
    client.getBlock = vi.fn(async () => fakeBlock(2n, 1700000002n));
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listOutbox("0xAlice" as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.recipient).toBe("0xBob");
    expect(result[0]?.valueGwei).toBe(10);
    expect(result[0]?.blockTimestamp).toBe(1700000002n);
  });

  it("applies the sinceBlock floor and limit and returns a descending array", async () => {
    const logs = [10, 11, 12, 13, 14].map((b, i) => log(b, i));
    const client = fakeClient(logs);
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const result = await src.listInbox("0xR" as any, 10n, 3);
    expect(result.map((m) => m.blockNumber)).toEqual([14n, 13n, 12n]);
    expect(client.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 10n }));
  });

  it("listInboxPage applies limit and returns descending order with a cursor", async () => {
    const logs = [10, 11, 12, 13, 14].map((b, i) => log(b, i));
    const client = fakeClient(logs);
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { sinceBlock: 10n, limit: 3 });
    expect(items.map((m) => m.blockNumber)).toEqual([14n, 13n, 12n]);
    expect(nextCursor).toBe(12n);
  });

  it("listInboxPage pages with a before cursor (toBlock = before-1) and stops when fully drained", async () => {
    const client = fakeClient([log(1, 0), log(2, 0)]);
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { before: 5n, limit: 10 });
    expect(client.getLogs).toHaveBeenCalledWith(expect.objectContaining({ toBlock: 4n }));
    expect(items.map((m) => m.blockNumber)).toEqual([2n, 1n]);
    expect(nextCursor).toBeUndefined();
  });

  it("listInboxPage short-circuits when the before cursor is at or below deployedAtBlock", async () => {
    const client = fakeClient([]);
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 100n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { before: 100n });
    expect(items).toEqual([]);
    expect(nextCursor).toBeUndefined();
    expect(client.getLogs).not.toHaveBeenCalled();
  });

  it("listInboxPage does not split a block across pages", async () => {
    // block 2 holds three events; with limit 2 the page must still return all of
    // block 2 (not just the newest event in it), so the next page can't skip them.
    const logs = [log(1, 0), log(2, 0), log(2, 1), log(2, 2), log(3, 0)];
    const client = fakeClient(logs);
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { limit: 2 });
    expect(items.map((m) => m.blockNumber)).toEqual([3n, 2n, 2n, 2n]);
    expect(nextCursor).toBe(2n);
  });

  it("scans backward in bounded windows down to the floor when the range is empty", async () => {
    const client = fakeClient([], { tip: 200n });
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n, logWindow: 50n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { limit: 5 });
    expect(items).toEqual([]);
    expect(nextCursor).toBeUndefined();
    // [151,200] [101,150] [51,100] [1,50] [0,0]
    expect(client.getLogs).toHaveBeenCalledTimes(5);
    expect(client.getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 0n, toBlock: 0n }));
  });

  it("stops scanning once it has more than `limit` events (no full re-scan)", async () => {
    const logs = [log(195, 0), log(196, 0), log(197, 0)];
    const client = fakeClient(logs, { tip: 200n });
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n, logWindow: 50n });
    const { items, nextCursor } = await src.listInboxPage("0xR" as any, { limit: 2 });
    expect(client.getLogs).toHaveBeenCalledTimes(1);
    expect(items.map((m) => m.blockNumber)).toEqual([197n, 196n]);
    expect(nextCursor).toBe(196n);
  });

  it("dedupes getBlock calls per unique block number", async () => {
    const client = fakeClient([log(5, 0), log(5, 1), log(6, 0)]);
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    await src.listInbox("0xR" as any);
    expect(client.getBlock).toHaveBeenCalledTimes(2);
  });

  it("subscribe calls watchEvent and returns the unsubscribe fn", () => {
    const unwatch = vi.fn();
    const client = fakeClient([]);
    client.watchEvent = vi.fn(() => unwatch);
    const src = createRpcMailSource({ client, contract: DEAD_CONTRACT, deployedAtBlock: 0n });
    const unsub = src.subscribe("0xR" as any, vi.fn());
    expect(client.watchEvent).toHaveBeenCalledOnce();
    expect(unsub).toBe(unwatch);
  });
});
