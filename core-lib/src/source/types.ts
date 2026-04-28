// MailSource interface defining the contract for inbox/outbox mail retrieval
// FEATURE: Mail source abstraction layer for RPC and indexer backends

import type { Address } from "viem";
import type { MailEvent, InboxView } from "../types";

export interface MailSource {
  listInbox(addr: Address, sinceBlock?: bigint, limit?: number): Promise<MailEvent[]>;
  listOutbox(addr: Address, sinceBlock?: bigint, limit?: number): Promise<MailEvent[]>;
  getInbox(addr: Address): Promise<InboxView>;
  subscribe(addr: Address, on: (m: MailEvent) => void): () => void;
}
