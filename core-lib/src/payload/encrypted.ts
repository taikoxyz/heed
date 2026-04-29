import type { Address } from "viem";
import { encryptForRecipients, decryptForRecipient, type EncryptedEnvelope } from "../crypto/lockbox";
import { encodePlaintext, decodePlaintext } from "./plaintext";
import type { PlaintextPayload } from "../types";

export interface RecipientKeyMaterial { rcpt: Address; keyNonce: number; pub: Uint8Array; }
export interface DecryptionKeyMaterial { rcpt: Address; keyNonce: number; sk: Uint8Array; }

export function encodeEncryptedBytes(plaintext: Uint8Array, rcpts: RecipientKeyMaterial[]): Uint8Array {
  const env = encryptForRecipients(plaintext, rcpts);
  return new TextEncoder().encode(JSON.stringify(env));
}

export function decodeEncryptedBytes(bytes: Uint8Array, key: DecryptionKeyMaterial): Uint8Array {
  const env = JSON.parse(new TextDecoder().decode(bytes)) as EncryptedEnvelope;
  return decryptForRecipient(env, key);
}

export function encodeEncrypted(payload: PlaintextPayload, rcpts: RecipientKeyMaterial[]): Uint8Array {
  return encodeEncryptedBytes(encodePlaintext(payload), rcpts);
}

export function decodeEncrypted(bytes: Uint8Array, key: DecryptionKeyMaterial): PlaintextPayload {
  return decodePlaintext(decodeEncryptedBytes(bytes, key));
}
