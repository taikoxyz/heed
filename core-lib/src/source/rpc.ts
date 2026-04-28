// RPC-based MailSource implementation using viem getLogs and watchEvent
// FEATURE: Mail source abstraction layer for RPC and indexer backends

import { type PublicClient, parseAbiItem, type Address } from "viem";
import type { MailSource } from "./types";
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

  return {
    async listInbox(addr, since, limit) {
      const logs = await opts.client.getLogs({
        address: opts.contract, event: MAIL_SENT,
        args: { recipient: addr },
        fromBlock: since ?? opts.deployedAtBlock,
      });
      const recent = logs.slice(-(limit ?? 100));
      return (await attachTimestamps(recent)).reverse();
    },
    async listOutbox(addr, since, limit) {
      const logs = await opts.client.getLogs({
        address: opts.contract, event: MAIL_SENT,
        args: { sender: addr },
        fromBlock: since ?? opts.deployedAtBlock,
      });
      const recent = logs.slice(-(limit ?? 100));
      return (await attachTimestamps(recent)).reverse();
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
