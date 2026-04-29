import {
  ENVELOPE_KIND,
  ENVELOPE_VERSION,
  TITLE_MAX_CHARS,
  URGENCY_VALUES,
  URI_MAX_CHARS,
  type Envelope,
} from "./schema";

export class EnvelopeDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeDecodeError";
  }
}

export function encodeEnvelope(env: Envelope): Uint8Array {
  validateEnvelope(env);
  return new TextEncoder().encode(JSON.stringify(env));
}

export function decodeEnvelope(bytes: Uint8Array): Envelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch (err) {
    throw new EnvelopeDecodeError(`invalid JSON: ${(err as Error).message}`);
  }
  if (!isEnvelopeShape(parsed)) {
    throw new EnvelopeDecodeError("not a v1 agent envelope");
  }
  validateEnvelope(parsed);
  return parsed;
}

export function tryDecodeEnvelope(bytes: Uint8Array): Envelope | null {
  try {
    return decodeEnvelope(bytes);
  } catch {
    return null;
  }
}

function isEnvelopeShape(value: unknown): value is Envelope {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.v !== "number") return false;
  if (typeof v.kind !== "string") return false;
  if (typeof v.title !== "string") return false;
  if (typeof v.body !== "string") return false;
  if (typeof v.urgency !== "string") return false;
  if (typeof v.sent_at !== "number") return false;
  if (v.from === null || typeof v.from !== "object") return false;
  const from = v.from as Record<string, unknown>;
  if (typeof from.name !== "string") return false;
  if (typeof from.owner_url !== "string") return false;
  if (typeof from.sig !== "string") return false;
  return true;
}

function validateEnvelope(env: Envelope): void {
  if (env.v !== ENVELOPE_VERSION) {
    throw new EnvelopeDecodeError(`unsupported envelope version: ${env.v}`);
  }
  if (env.kind !== ENVELOPE_KIND) {
    throw new EnvelopeDecodeError(`unsupported envelope kind: ${env.kind}`);
  }
  if (env.title.length > TITLE_MAX_CHARS) {
    throw new EnvelopeDecodeError(`title exceeds ${TITLE_MAX_CHARS} chars`);
  }
  if (!URGENCY_VALUES.includes(env.urgency)) {
    throw new EnvelopeDecodeError(`invalid urgency: ${env.urgency}`);
  }
  if (env.from.uri !== undefined && env.from.uri.length > URI_MAX_CHARS) {
    throw new EnvelopeDecodeError(`from.uri exceeds ${URI_MAX_CHARS} chars`);
  }
  if (!env.from.sig.startsWith("0x")) {
    throw new EnvelopeDecodeError("from.sig must be 0x-prefixed hex");
  }
  if (env.action_url !== undefined && !env.action_url.startsWith("https://")) {
    throw new EnvelopeDecodeError("action_url must be https://");
  }
  if (env.reply_to !== undefined && !env.reply_to.startsWith("0x")) {
    throw new EnvelopeDecodeError("reply_to must be 0x-prefixed hex");
  }
  if (!Number.isInteger(env.sent_at) || env.sent_at < 0) {
    throw new EnvelopeDecodeError("sent_at must be a non-negative integer");
  }
}
