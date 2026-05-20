import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID, CONTRACT, RECIPIENT_PK, RPC_URL } from "./harness";
import { KEY_TYPED_DATA } from "@heed/core";

export interface WalletStubData {
  address: string;
  chainIdHex: string;
  rpcUrl: string;
  keySignature: Hex;
}

// Pre-sign the single EIP-712 prompt the inbox makes: the KEY typed-data for
// keyNonce 0, which the app turns into the recipient's X25519 secret key.
export async function buildWalletStubData(): Promise<WalletStubData> {
  const account = privateKeyToAccount(RECIPIENT_PK);
  const keySignature = await account.signTypedData({
    domain: KEY_TYPED_DATA.domain(CHAIN_ID, CONTRACT),
    types: KEY_TYPED_DATA.types,
    primaryType: KEY_TYPED_DATA.primaryType,
    message: KEY_TYPED_DATA.message(0),
  });
  return {
    address: account.address,
    chainIdHex: `0x${CHAIN_ID.toString(16)}`,
    rpcUrl: RPC_URL,
    keySignature,
  };
}

// Serialized into the page via addInitScript; runs before any app code so the
// wagmi `injected()` connector discovers it as window.ethereum.
export function walletStubInit(data: WalletStubData): string {
  return `(${installStub.toString()})(${JSON.stringify(data)});`;
}

function installStub(data: WalletStubData) {
  const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
  const provider = {
    isMetaMask: true,
    async request(args: { method: string; params?: unknown[] }) {
      switch (args.method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [data.address];
        case "eth_chainId":
          return data.chainIdHex;
        case "net_version":
          return String(parseInt(data.chainIdHex, 16));
        case "wallet_getPermissions":
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts" }];
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "eth_signTypedData_v4":
          return data.keySignature;
        default: {
          const res = await fetch(data.rpcUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: args.method,
              params: args.params ?? [],
            }),
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error.message);
          return json.result;
        }
      }
    },
    on(event: string, handler: (...a: unknown[]) => void) {
      (listeners[event] ??= []).push(handler);
    },
    removeListener(event: string, handler: (...a: unknown[]) => void) {
      listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler);
    },
  };
  Object.defineProperty(window, "ethereum", {
    value: provider,
    writable: true,
    configurable: true,
  });
  window.dispatchEvent(new Event("ethereum#initialized"));
}
