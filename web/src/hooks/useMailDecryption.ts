import { useAccount, useSignTypedData } from "wagmi";
import {
  decodeEncrypted,
  digestToCid,
  fetchCid,
  KEY_TYPED_DATA,
  type EncryptedPayload,
  type PlaintextPayload,
} from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";
import { evictKey, getCachedKey, putKey } from "../lib/keys";

export function useMailDecryption() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  return async function decrypt(
    contentRefHex: `0x${string}`,
    options: { force?: boolean } = {},
  ): Promise<PlaintextPayload> {
    if (!address) throw new Error("no wallet connected");

    const cfg = getEffectiveConfig();
    const digest = hexToBytes(contentRefHex);
    const cid = digestToCid(digest);
    const bytes = await fetchCid(cid, cfg.ipfsGateway);

    const env = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as EncryptedPayload;
    const me = address.toLowerCase();
    const lockbox = env.lockboxes.find((l) => l.rcpt.toLowerCase() === me);
    if (!lockbox) {
      throw new Error("no lockbox for this address");
    }

    if (options.force) evictKey(address, lockbox.keyNonce);

    let sk = getCachedKey(address, lockbox.keyNonce);
    if (!sk) {
      const sig = await signTypedDataAsync({
        domain: KEY_TYPED_DATA.domain(cfg.chainId, cfg.contractAddress),
        types: KEY_TYPED_DATA.types,
        primaryType: KEY_TYPED_DATA.primaryType,
        message: KEY_TYPED_DATA.message(lockbox.keyNonce),
      });
      sk = putKey(address, lockbox.keyNonce, sig);
    }

    return decodeEncrypted(bytes, {
      rcpt: address,
      keyNonce: lockbox.keyNonce,
      sk,
    });
  };
}

function hexToBytes(h: string) {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
