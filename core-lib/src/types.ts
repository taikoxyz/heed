import type { Address, Hash, Hex } from "viem";

export type ContentRef = Hex;

export interface EncKey {
  keyNonce: number;
  publishedAt: bigint;
  pub: Hex;
}

export interface MailIntent {
  recipient: Address;
  valueGwei: number;
  contentRef: ContentRef;
}

export interface InboxView {
  feeGwei: number;
  keys: [EncKey, EncKey];
}

export interface MailEvent {
  txHash: Hash;
  blockNumber: bigint;
  blockTimestamp: bigint;
  sender: Address;
  recipient: Address;
  contentRef: ContentRef;
  valueGwei: number;
}

export interface PlaintextPayload {
  v: 1;
  kind: "mail";
  from: Address;
  to: Address[];
  cc: Address[];
  date: number;
  msgId: string;
  inReplyTo?: string;
  references?: string[];
  subject: string;
  body: { text: string; html?: string };
  attachments: Attachment[];
}

export interface Attachment {
  name: string;
  cid: string;
  size: number;
  mime: string;
}

export interface EncryptedPayload {
  v: 1;
  scheme: 1;
  nonce: string;
  lockboxes: Lockbox[];
  ct: string;
}

export interface Lockbox {
  rcpt: Address;
  keyNonce: number;
  wrapped: string;
}
