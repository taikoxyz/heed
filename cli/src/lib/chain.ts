import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createReadClient, createWriteClient } from "@heed/core";
import type { RecipientKey } from "./send";

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
  const wallet = createWalletClient({ account, transport: http(args.rpcUrl), chain });
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
  const publicClient = createPublicClient({ transport: http(args.rpcUrl), chain });
  const read = createReadClient(publicClient, args.contract);
  const inbox = await read.getInbox(args.recipient);
  const current = inbox.keys[0];
  return { pub: current.pub, keyNonce: current.keyNonce, feeGwei: inbox.feeGwei };
}

export async function sendBatchOnChain(args: {
  privateKey: Hex;
  rpcUrl: string;
  chainId: number;
  contract: Address;
  mails: { recipient: Address; valueGwei: number; contentRef: Hex }[];
  totalValueWei: bigint;
}): Promise<Hash> {
  const account = privateKeyToAccount(args.privateKey);
  const chain = buildChain({ chainId: args.chainId, rpcUrl: args.rpcUrl });
  const wallet = createWalletClient({ account, transport: http(args.rpcUrl), chain });
  const write = createWriteClient(wallet, args.contract);
  return await write.sendBatch(args.mails, false, args.totalValueWei);
}
