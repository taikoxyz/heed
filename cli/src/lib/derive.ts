import { bytesToHex, hexToBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey as viemGeneratePrivateKey } from "viem/accounts";
import { KEY_TYPED_DATA, deriveX25519Private, deriveX25519Public } from "@heed/core";

export interface AgentKeys {
  address: Address;
  encryptionPriv: Uint8Array;
  encryptionPub: Hex;
}

export async function deriveAgentKeys(args: {
  privateKey: Hex;
  chainId: number;
  contract: Address;
  keyNonce: number;
}): Promise<AgentKeys> {
  const account = privateKeyToAccount(args.privateKey);
  const signature = await account.signTypedData({
    domain: KEY_TYPED_DATA.domain(args.chainId, args.contract),
    types: KEY_TYPED_DATA.types,
    primaryType: KEY_TYPED_DATA.primaryType,
    message: KEY_TYPED_DATA.message(args.keyNonce),
  });
  const encryptionPriv = deriveX25519Private(hexToBytes(signature));
  const encryptionPub = bytesToHex(deriveX25519Public(encryptionPriv));
  return { address: account.address, encryptionPriv, encryptionPub };
}

export function generatePrivateKey(): Hex {
  return viemGeneratePrivateKey();
}
