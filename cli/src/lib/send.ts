import { createHash } from "node:crypto";
import {
  bytesToHex,
  hexToBytes,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  cidToDigest,
  digestToCid,
  encodeEncryptedBytes,
  encodeEnvelope,
  signEnvelope,
  type Envelope,
  type UnsignedEnvelope,
  type Urgency,
} from "@heed/core";
import type { HeedConfig } from "../config/store";

export interface SendArgs {
  to: Address;
  title: string;
  body: string;
  urgency: Urgency;
  actionUrl?: string;
  replyTo?: Hex;
}

export interface RecipientKey {
  pub: Hex;
  keyNonce: number;
  feeGwei: number;
}

export interface SendDeps {
  privateKey: Hex;
  config: HeedConfig;
  lookupRecipient: (addr: Address) => Promise<RecipientKey>;
  pin: (bytes: Uint8Array, name: string) => Promise<string>;
  sendBatch: (args: {
    mails: { recipient: Address; valueGwei: number; contentRef: Hex }[];
    totalValueWei: bigint;
  }) => Promise<Hash>;
  now: () => number;
}

export interface SendResult {
  txHash: Hash;
  contentRef: Hex;
  cid: string;
  feeGwei: number;
  signedEnvelope: Envelope;
}

export interface DryRunResult {
  feeGwei: number;
  contentRef: Hex;
  cid: string;
  signedEnvelope: Envelope;
  encryptedSize: number;
}

export async function buildSignedEnvelope(args: {
  send: SendArgs;
  privateKey: Hex;
  config: HeedConfig;
  now: () => number;
}): Promise<Envelope> {
  const { send, privateKey, config, now } = args;
  const account = privateKeyToAccount(privateKey);
  const unsigned: UnsignedEnvelope = {
    v: 1,
    kind: "agent",
    from: {
      name: config.identity.name,
      owner_url: config.identity.owner_url,
      ...(config.identity.logo_cid !== undefined && config.identity.logo_cid !== "" && { logo_cid: config.identity.logo_cid }),
      ...(config.identity.uri !== undefined && config.identity.uri !== "" && { uri: config.identity.uri }),
    },
    title: send.title,
    body: send.body,
    urgency: send.urgency,
    ...(send.actionUrl !== undefined && { action_url: send.actionUrl }),
    ...(send.replyTo !== undefined && { reply_to: send.replyTo }),
    sent_at: Math.floor(now() / 1000),
  };
  return await signEnvelope({
    envelope: unsigned,
    chainId: config.network.chain_id,
    verifyingContract: config.network.contract,
    signer: (typedData) => account.signTypedData(typedData),
  });
}

export async function runSend(args: SendArgs, deps: SendDeps): Promise<SendResult> {
  const { encrypted, signed, recipient } = await prepareForWire(args, deps);
  const cid = await deps.pin(encrypted, `heed-${args.to}-${signed.sent_at}`);
  const contentRef = bytesToHex(cidToDigest(cid));
  const totalValueWei = BigInt(recipient.feeGwei) * 10n ** 9n;
  const txHash = await deps.sendBatch({
    mails: [{ recipient: args.to, valueGwei: recipient.feeGwei, contentRef }],
    totalValueWei,
  });
  return { txHash, contentRef, cid, feeGwei: recipient.feeGwei, signedEnvelope: signed };
}

export async function runSendDryRun(args: SendArgs, deps: Omit<SendDeps, "pin" | "sendBatch">): Promise<DryRunResult> {
  const { encrypted, signed, recipient } = await prepareForWire(args, deps);
  const cid = digestToCid(sha256OfBytes(encrypted));
  const contentRef = bytesToHex(cidToDigest(cid));
  return { feeGwei: recipient.feeGwei, contentRef, cid, signedEnvelope: signed, encryptedSize: encrypted.length };
}

async function prepareForWire(
  args: SendArgs,
  deps: Omit<SendDeps, "pin" | "sendBatch">,
): Promise<{ encrypted: Uint8Array; signed: Envelope; recipient: RecipientKey }> {
  const recipient = await deps.lookupRecipient(args.to);
  if (!recipient.pub || /^0x0{64}$/i.test(recipient.pub)) {
    throw new Error(
      `recipient ${args.to} has not published an encryption key. they must run \`heed setup\` (or publish a key) before they can receive mail.`,
    );
  }
  const signed = await buildSignedEnvelope({ send: args, privateKey: deps.privateKey, config: deps.config, now: deps.now });
  const envBytes = encodeEnvelope(signed);
  const encrypted = encodeEncryptedBytes(envBytes, [
    { rcpt: args.to, keyNonce: recipient.keyNonce, pub: hexToBytes(recipient.pub) },
  ]);
  return { encrypted, signed, recipient };
}

function sha256OfBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}
