// RPC-based MailSource implementation using viem getLogs and watchEvent
// FEATURE: Mail source abstraction layer for RPC and indexer backends

import { type PublicClient, parseAbiItem, type Address } from "viem";
import type { MailSource, MailPage } from "./types";
import type { MailEvent } from "../types";
import { createReadClient } from "../contract/client";

const MAIL_SENT = parseAbiItem(
  "event MailSent(address indexed sender, address indexed recipient, bytes32 contentRef, uint32 valueGwei)"
);

export function createRpcMailSource(opts: {
  client: PublicClient; contract: Address; deployedAtBlock: bigint;
}): MailSource {
  const reader = createReadClient(opts.client, opts.contract);

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
    const toBlock = before !== undefined ? before - 1n : undefined;
    if (toBlock !== undefined && toBlock < opts.deployedAtBlock) {
      return { items: [] };
    }
    const logs = await opts.client.getLogs({
      address: opts.contract, event: MAIL_SENT,
      args,
      fromBlock: sinceBlock ?? opts.deployedAtBlock,
      ...(toBlock !== undefined ? { toBlock } : {}),
    });
    if (logs.length <= limit) {
      return { items: (await attachTimestamps(logs)).reverse() };
    }
    // Keep pages block-aligned: never split one block across pages, or the next
    // page (toBlock = cursor - 1) would skip that block's remaining events.
    const blockAt = (i: number) => (logs[i] as { blockNumber: bigint }).blockNumber;
    let cut = logs.length - limit;
    const cutBlock = blockAt(cut);
    while (cut > 0 && blockAt(cut - 1) === cutBlock) cut--;
    const items = (await attachTimestamps(logs.slice(cut))).reverse();
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
