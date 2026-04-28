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
  return {
    async listInbox(addr, since, limit) {
      const logs = await opts.client.getLogs({
        address: opts.contract, event: MAIL_SENT,
        args: { recipient: addr },
        fromBlock: since ?? opts.deployedAtBlock,
      });
      return logs.slice(-(limit ?? 100)).map(toEvent);
    },
    async listOutbox(addr, since, limit) {
      const logs = await opts.client.getLogs({
        address: opts.contract, event: MAIL_SENT,
        args: { sender: addr },
        fromBlock: since ?? opts.deployedAtBlock,
      });
      return logs.slice(-(limit ?? 100)).map(toEvent);
    },
    async getInbox(addr) { return reader.getInbox(addr); },
    subscribe(addr, on) {
      return opts.client.watchEvent({
        address: opts.contract, event: MAIL_SENT,
        args: { recipient: addr },
        onLogs: (logs) => logs.forEach((l) => on(toEvent(l))),
      });
    },
  };
}

function toEvent(log: any): MailEvent {
  return {
    txHash: log.transactionHash, blockNumber: log.blockNumber, blockTimestamp: 0n,
    sender: log.args.sender, recipient: log.args.recipient,
    contentRef: log.args.contentRef, valueGwei: Number(log.args.valueGwei),
  };
}
