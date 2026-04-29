import { createWalletClient, defineChain, http, type Address, type Hash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createWriteClient } from "@heed/core";

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
