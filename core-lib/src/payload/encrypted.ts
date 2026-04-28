import type { Address } from "viem";
import { encryptForRecipients, decryptForRecipient, type EncryptedEnvelope } from "../crypto/lockbox";
import { encodePlaintext, decodePlaintext } from "./plaintext";
import type { PlaintextPayload } from "../types";

export interface RecipientKeyMaterial { rcpt: Address; keyNonce: number; pub: Uint8Array; }
export interface DecryptionKeyMaterial { rcpt: Address; keyNonce: number; sk: Uint8Array; }

export function encodeEncrypted(payload: PlaintextPayload, rcpts: RecipientKeyMaterial[]): Uint8Array {
  const env = encryptForRecipients(encodePlaintext(payload), rcpts);
  return new TextEncoder().encode(JSON.stringify(env));
}

export function decodeEncrypted(bytes: Uint8Array, key: DecryptionKeyMaterial): PlaintextPayload {
  const env = JSON.parse(new TextDecoder().decode(bytes)) as EncryptedEnvelope;
  const inner = decryptForRecipient(env, key);
  return decodePlaintext(inner);
}
