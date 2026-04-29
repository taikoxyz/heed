// Viem-based read and write clients wrapping the Heed contract ABI
// FEATURE: Contract client layer for Heed protocol interaction

import { type Address, type PublicClient, type WalletClient, type Hex, getContract } from "viem";
import { HEED_ABI } from "./abi";
import type { InboxView } from "../types";

export function createReadClient(client: PublicClient, address: Address) {
  const contract = getContract({ address, abi: HEED_ABI, client });
  return {
    async getInbox(addr: Address): Promise<InboxView> {
      return (await contract.read.getInbox([addr])) as InboxView;
    },
    async getInboxes(addrs: Address[]): Promise<InboxView[]> {
      return (await contract.read.getInboxes([addrs])) as InboxView[];
    },
    async feeGwei(addr: Address): Promise<number> {
      return Number(await contract.read.feeGwei([addr]));
    },
    async trusts(rcpt: Address, sender: Address): Promise<boolean> {
      return contract.read.trusts([rcpt, sender]) as Promise<boolean>;
    },
  };
}

export function createWriteClient(wallet: WalletClient, address: Address) {
  const write = (functionName: string, args: unknown[], value = 0n) =>
    wallet.writeContract({ address, abi: HEED_ABI, functionName: functionName as never, args: args as never, value: value as never, chain: wallet.chain, account: wallet.account! });

  return {
    publishKey: (keyNonce: number, pub: Hex) =>
      write("publishKey", [keyNonce, pub]),
    setFee: (valueGwei: number) =>
      write("setFee", [valueGwei]),
    trust: (senders: Address[]) =>
      write("trust", [senders]),
    untrust: (senders: Address[]) =>
      write("untrust", [senders]),
    sendBatch: (
      mails: Array<{ recipient: Address; valueGwei: number; contentRef: Hex }>,
      atomic: boolean,
      totalValueWei: bigint,
    ) => write("sendBatch", [mails, atomic], totalValueWei),
  };
}
