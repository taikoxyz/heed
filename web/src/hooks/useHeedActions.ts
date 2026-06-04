import { useAccount, useSignTypedData, useWalletClient } from "wagmi";
import {
  bytesToHex,
  createPublicClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  createWriteClient,
  deriveX25519Public,
  KEY_TYPED_DATA,
} from "@heed/core";
import { putKey } from "../lib/keys";
import { getEffectiveConfig } from "../lib/settings";

async function confirm(client: PublicClient, txHash: Hex): Promise<Hex> {
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`transaction reverted (${txHash})`);
  }
  return txHash;
}

export function useHeedActions() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signTypedDataAsync } = useSignTypedData();

  function ctx() {
    if (!address) throw new Error("connect a wallet first");
    if (!walletClient) throw new Error("wallet not ready");
    const cfg = getEffectiveConfig(chainId);
    return {
      address,
      cfg,
      writer: createWriteClient(walletClient, cfg.contractAddress),
      publicClient: createPublicClient({
        chain: cfg.chain,
        transport: http(cfg.rpcUrl),
      }),
    };
  }

  return {
    async publishKey(keyNonce: number): Promise<{ txHash: Hex; pub: Hex }> {
      const { address, cfg, writer, publicClient } = ctx();
      const sig = await signTypedDataAsync({
        domain: KEY_TYPED_DATA.domain(cfg.chainId, cfg.contractAddress),
        types: KEY_TYPED_DATA.types,
        primaryType: KEY_TYPED_DATA.primaryType,
        message: KEY_TYPED_DATA.message(keyNonce),
      });
      const sk = putKey(address, keyNonce, sig);
      const pub = bytesToHex(deriveX25519Public(sk));
      const txHash = await confirm(
        publicClient,
        await writer.publishKey(keyNonce, pub),
      );
      return { txHash, pub };
    },

    async setFee(valueGwei: number): Promise<Hex> {
      const { writer, publicClient } = ctx();
      return confirm(publicClient, await writer.setFee(valueGwei));
    },

    async trust(senders: Address[]): Promise<Hex> {
      const { writer, publicClient } = ctx();
      return confirm(publicClient, await writer.trust(senders));
    },

    async untrust(senders: Address[]): Promise<Hex> {
      const { writer, publicClient } = ctx();
      return confirm(publicClient, await writer.untrust(senders));
    },
  };
}
