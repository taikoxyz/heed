import { tryDecodeEnvelope, type Envelope } from "../envelope";
import { decodePlaintext } from "./plaintext";
import type { PlaintextPayload } from "../types";

export type DecodedPayload =
  | { kind: "envelope"; envelope: Envelope }
  | { kind: "mail"; mail: PlaintextPayload }
  | { kind: "unknown"; bytes: Uint8Array };

export function decodePayload(bytes: Uint8Array): DecodedPayload {
  const env = tryDecodeEnvelope(bytes);
  if (env) return { kind: "envelope", envelope: env };
  try {
    const mail = decodePlaintext(bytes);
    if (isMailPayload(mail)) return { kind: "mail", mail };
  } catch {
    /* fall through */
  }
  return { kind: "unknown", bytes };
}

function isMailPayload(value: unknown): value is PlaintextPayload {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.v === 1 && v.kind === "mail" && typeof v.subject === "string";
}
