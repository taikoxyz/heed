import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  hexToBytes,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createReadClient,
  createWriteClient,
  createRpcMailSource,
  digestToCid,
  fetchCid,
  HEED_ABI,
  type MailEvent,
  type MailSource,
} from "@heed/core";
import type { DeliveryReceipt, RecipientKey } from "./send";

export function buildChain(args: { chainId: number; rpcUrl: string }) {
  return defineChain({
    id: args.chainId,
    name: `chain-${args.chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [args.rpcUrl] } },
  });
}

export async function publishKeyOnChain(args: {
  privateKey: Hex;
  rpcUrl: string;
  chainId: number;
  contract: Address;
  keyNonce: number;
  pub: Hex;
}): Promise<Hash> {
  const account = privateKeyToAccount(args.privateKey);
  const chain = buildChain({ chainId: args.chainId, rpcUrl: args.rpcUrl });
  const wallet = createWalletClient({
    account,
    transport: http(args.rpcUrl),
    chain,
  });
  const write = createWriteClient(wallet, args.contract);
  return await write.publishKey(args.keyNonce, args.pub);
}

export async function lookupRecipient(args: {
  rpcUrl: string;
  chainId: number;
  contract: Address;
  recipient: Address;
}): Promise<RecipientKey> {
  const chain = buildChain({ chainId: args.chainId, rpcUrl: args.rpcUrl });
  const publicClient = createPublicClient({
    transport: http(args.rpcUrl),
    chain,
  });
  const read = createReadClient(publicClient, args.contract);
  const inbox = await read.getInbox(args.recipient);
  const current = inbox.keys[0];
  return {
    pub: current.pub,
    keyNonce: current.keyNonce,
    feeGwei: inbox.feeGwei,
  };
}

export async function sendBatchOnChain(args: {
  privateKey: Hex;
  rpcUrl: string;
  chainId: number;
  contract: Address;
  mails: { recipient: Address; valueGwei: number; contentRef: Hex }[];
  totalValueWei: bigint;
  atomic: boolean;
  wait: boolean;
}): Promise<{ txHash: Hash; receipt?: DeliveryReceipt }> {
  const account = privateKeyToAccount(args.privateKey);
  const chain = buildChain({ chainId: args.chainId, rpcUrl: args.rpcUrl });
  const wallet = createWalletClient({
    account,
    transport: http(args.rpcUrl),
    chain,
  });
  const write = createWriteClient(wallet, args.contract);
  const txHash = await write.sendBatch(
    args.mails,
    args.atomic,
    args.totalValueWei,
  );
  if (!args.wait) return { txHash };

  const publicClient = createPublicClient({
    transport: http(args.rpcUrl),
    chain,
  });
  const txReceipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  const sentLogs = parseEventLogs({
    abi: HEED_ABI,
    eventName: "MailSent",
    logs: txReceipt.logs,
  });
  // delivered iff the tx succeeded AND every intended recipient was the
  // `recipient` indexed arg on a MailSent event in the same tx.
  const sentRecipients = new Set(
    sentLogs.map((l) =>
      (l.args as { recipient: Address }).recipient.toLowerCase(),
    ),
  );
  const expected = args.mails.map((m) => m.recipient.toLowerCase());
  const delivered =
    txReceipt.status === "success" &&
    expected.every((r) => sentRecipients.has(r));

  const gasPrice = txReceipt.effectiveGasPrice ?? 0n;
  const gasCost = txReceipt.gasUsed * gasPrice;
  // If the tx reverted the value is refunded, so it didn't cost the sender.
  const valuePaid = txReceipt.status === "success" ? args.totalValueWei : 0n;
  return {
    txHash,
    receipt: {
      status: txReceipt.status,
      blockNumber: txReceipt.blockNumber,
      gasUsed: txReceipt.gasUsed,
      totalCostWei: gasCost + valuePaid,
      delivered,
    },
  };
}

export function buildMailSource(args: {
  rpcUrl: string;
  chainId: number;
  contract: Address;
  deployedAtBlock: bigint;
}): MailSource {
  const chain = buildChain({ chainId: args.chainId, rpcUrl: args.rpcUrl });
  const publicClient = createPublicClient({
    transport: http(args.rpcUrl),
    chain,
  });
  return createRpcMailSource({
    client: publicClient,
    contract: args.contract,
    deployedAtBlock: args.deployedAtBlock,
  });
}

export async function fetchByContentRef(args: {
  gateway: string;
  contentRef: Hex;
}): Promise<Uint8Array> {
  const cid = digestToCid(hexToBytes(args.contentRef));
  return await fetchCid(cid, args.gateway);
}

export type { MailEvent, MailSource };
