// RPC-based MailSource implementation using viem getLogs and watchEvent
// FEATURE: Mail source abstraction layer for RPC and indexer backends

import { type PublicClient, parseAbiItem, type Address } from "viem";
import type { MailSource, MailPage } from "./types";
import type { MailEvent } from "../types";
import { createReadClient } from "../contract/client";

const MAIL_SENT = parseAbiItem(
  "event MailSent(address indexed sender, address indexed recipient, bytes32 contentRef, uint32 valueGwei)"
);

const DEFAULT_LOG_WINDOW = 50_000n;

export function createRpcMailSource(opts: {
  client: PublicClient; contract: Address; deployedAtBlock: bigint; logWindow?: bigint;
}): MailSource {
  const reader = createReadClient(opts.client, opts.contract);
  const windowSize = opts.logWindow ?? DEFAULT_LOG_WINDOW;

  async function attachTimestamps(logs: any[]): Promise<MailEvent[]> {
    if (logs.length === 0) return [];
    const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber as bigint))];
    const blocks = await Promise.all(
      uniqueBlocks.map((blockNumber) => opts.client.getBlock({ blockNumber })),
    );
    const tsByBlock = new Map(blocks.map((b) => [b.number!, b.timestamp]));
    return logs.map((l) => toEvent(l, tsByBlock.get(l.blockNumber) ?? 0n));
  }

  async function page(
    args: object, sinceBlock?: bigint, limit = 100, before?: bigint,
  ): Promise<MailPage> {
    const floor = sinceBlock ?? opts.deployedAtBlock;
    let hi = before !== undefined ? before - 1n : await opts.client.getBlockNumber();
    if (hi < floor) return { items: [] };

    // Walk backward in bounded windows so each page only scans from its cursor
    // toward the floor (never re-reading the whole history) and stays under
    // provider getLogs range limits. Stop as soon as we have more than `limit`.
    let collected: any[] = [];
    while (hi >= floor && collected.length <= limit) {
      const lo = hi - windowSize + 1n > floor ? hi - windowSize + 1n : floor;
      const logs = await opts.client.getLogs({
        address: opts.contract, event: MAIL_SENT, args, fromBlock: lo, toBlock: hi,
      });
      if (logs.length > 0) collected = (logs as any[]).concat(collected);
      if (lo === floor) break;
      hi = lo - 1n;
    }

    if (collected.length <= limit) {
      return { items: (await attachTimestamps(collected)).reverse() };
    }
    // Keep pages block-aligned: never split one block across pages, or the next
    // page (toBlock = cursor - 1) would skip that block's remaining events.
    const blockAt = (i: number) => (collected[i] as { blockNumber: bigint }).blockNumber;
    let cut = collected.length - limit;
    const cutBlock = blockAt(cut);
    while (cut > 0 && blockAt(cut - 1) === cutBlock) cut--;
    const items = (await attachTimestamps(collected.slice(cut))).reverse();
    return cut > 0 ? { items, nextCursor: cutBlock } : { items };
  }

  return {
    async listInbox(addr, since, limit) {
      return (await page({ recipient: addr }, since, limit)).items;
    },
    async listOutbox(addr, since, limit) {
      return (await page({ sender: addr }, since, limit)).items;
    },
    listInboxPage(addr, o = {}) {
      return page({ recipient: addr }, o.sinceBlock, o.limit, o.before);
    },
    listOutboxPage(addr, o = {}) {
      return page({ sender: addr }, o.sinceBlock, o.limit, o.before);
    },
    async getInbox(addr) { return reader.getInbox(addr); },
    subscribe(addr, on) {
      return opts.client.watchEvent({
        address: opts.contract, event: MAIL_SENT,
        args: { recipient: addr },
        onLogs: async (logs) => {
          const events = await attachTimestamps([...logs]);
          events.forEach(on);
        },
      });
    },
  };
}

function toEvent(log: any, blockTimestamp: bigint): MailEvent {
  return {
    txHash: log.transactionHash, blockNumber: log.blockNumber, blockTimestamp,
    sender: log.args.sender, recipient: log.args.recipient,
    contentRef: log.args.contentRef, valueGwei: Number(log.args.valueGwei),
  };
}
