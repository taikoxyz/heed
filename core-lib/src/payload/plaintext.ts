import type { PlaintextPayload } from "../types";
export function encodePlaintext(p: PlaintextPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(p));
}
export function decodePlaintext(bytes: Uint8Array): PlaintextPayload {
  return JSON.parse(new TextDecoder().decode(bytes)) as PlaintextPayload;
}
