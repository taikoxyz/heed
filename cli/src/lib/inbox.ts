import { hexToBytes, type Address, type Hash, type Hex } from "viem";
import {
  decodeEncryptedBytes,
  decodePayload,
  digestToCid,
  recoverEnvelopeSigner,
  type DecodedPayload,
  type MailEvent,
} from "@heed/core";

export interface InboxArgs {
  sinceBlock?: bigint;
  limit?: number;
}

export interface InboxMessage {
  txHash: Hash;
  blockNumber: bigint;
  blockTimestamp: number;
  sender: Address;
  recipient: Address;
  contentRef: Hex;
  valueGwei: number;
  decoded: DecodedPayload;
  signatureValid?: boolean;
  signerMatchesSender?: boolean;
  decodeError?: string;
}

export interface InboxDeps {
  walletAddress: Address;
  encryptionKeyNonce: number;
  encryptionPriv: Uint8Array;
  chainId: number;
  verifyingContract: Address;
  listInbox: (sinceBlock?: bigint, limit?: number) => Promise<MailEvent[]>;
  watchInbox?: (handler: (event: MailEvent) => void) => () => void;
  fetchByContentRef: (contentRef: Hex) => Promise<Uint8Array>;
}

export async function runInboxList(args: InboxArgs, deps: InboxDeps): Promise<InboxMessage[]> {
  const events = await deps.listInbox(args.sinceBlock, args.limit);
  return Promise.all(events.map((event) => hydrateMessage(event, deps)));
}

export async function hydrateMessage(event: MailEvent, deps: InboxDeps): Promise<InboxMessage> {
  const base: InboxMessage = {
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    blockTimestamp: Number(event.blockTimestamp),
    sender: event.sender,
    recipient: event.recipient,
    contentRef: event.contentRef,
    valueGwei: event.valueGwei,
    decoded: { kind: "unknown", bytes: new Uint8Array() },
  };

  let plaintext: Uint8Array;
  try {
    const cid = digestToCid(hexToBytes(event.contentRef));
    const encrypted = await deps.fetchByContentRef(event.contentRef);
    plaintext = decodeEncryptedBytes(encrypted, {
      rcpt: deps.walletAddress,
      keyNonce: deps.encryptionKeyNonce,
      sk: deps.encryptionPriv,
    });
    void cid;
  } catch (err) {
    return { ...base, decodeError: (err as Error).message };
  }

  const decoded = decodePayload(plaintext);
  const out: InboxMessage = { ...base, decoded };

  if (decoded.kind === "envelope") {
    try {
      const signer = await recoverEnvelopeSigner({
        envelope: decoded.envelope,
        chainId: deps.chainId,
        verifyingContract: deps.verifyingContract,
      });
      out.signatureValid = true;
      out.signerMatchesSender = signer.toLowerCase() === event.sender.toLowerCase();
    } catch {
      out.signatureValid = false;
      out.signerMatchesSender = false;
    }
  }

  return out;
}

export function watchInbox(
  deps: InboxDeps,
  onMessage: (m: InboxMessage) => void,
): () => void {
  if (!deps.watchInbox) throw new Error("watchInbox not provided by deps");
  return deps.watchInbox(async (event: MailEvent) => {
    const msg = await hydrateMessage(event, deps);
    onMessage(msg);
  });
}
