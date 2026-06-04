import { useAccount, useSignTypedData } from "wagmi";
import {
  decodeEncryptedBytes,
  decodePayload,
  digestToCid,
  fetchCidWithFallback,
  KEY_TYPED_DATA,
  type DecodedPayload,
} from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";
import { evictKey, getCachedKey, putKey } from "../lib/keys";
import { getDecoded, putDecoded } from "../lib/db";

interface EncryptedShape {
  v: 1;
  scheme: 1;
  lockboxes: { rcpt: string; keyNonce: number; wrapped: string }[];
}

export function useMailDecryption() {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  return async function decrypt(
    contentRefHex: `0x${string}`,
    options: { force?: boolean } = {},
  ): Promise<DecodedPayload> {
    if (!address) throw new Error("no wallet connected");

    if (!options.force) {
      const cached = await getDecoded(contentRefHex).catch(() => undefined);
      if (cached) return cached;
    }

    const cfg = getEffectiveConfig(chainId);
    const digest = hexToBytes(contentRefHex);
    const cid = digestToCid(digest);
    const bytes = await fetchCidWithFallback(cid, cfg.ipfsGateways);

    const outer = tryParseJson(bytes);
    if (!isEncryptedShape(outer)) {
      const plain = decodePayload(bytes);
      await putDecoded(contentRefHex, plain).catch(() => {});
      return plain;
    }

    const me = address.toLowerCase();
    const lockbox = outer.lockboxes.find((l) => l.rcpt.toLowerCase() === me);
    if (!lockbox) throw new Error("no lockbox for this address");

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

    const inner = decodeEncryptedBytes(bytes, {
      rcpt: address,
      keyNonce: lockbox.keyNonce,
      sk,
    });
    const decoded = decodePayload(inner);
    await putDecoded(contentRefHex, decoded).catch(() => {});
    return decoded;
  };
}

function isEncryptedShape(value: unknown): value is EncryptedShape {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.v === 1 && v.scheme === 1 && Array.isArray(v.lockboxes);
}

function tryParseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function hexToBytes(h: string) {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
