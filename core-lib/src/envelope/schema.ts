import type { Hex } from "viem";

export type Urgency = "low" | "normal" | "high";

export interface EnvelopeFrom {
  name: string;
  owner_url: string;
  logo_cid?: string;
  uri?: string;
  sig: Hex;
}

export type UnsignedEnvelopeFrom = Omit<EnvelopeFrom, "sig">;

export interface Envelope {
  v: 1;
  kind: "agent";
  from: EnvelopeFrom;
  title: string;
  body: string;
  urgency: Urgency;
  action_url?: string;
  reply_to?: Hex;
  sent_at: number;
}

export type UnsignedEnvelope = Omit<Envelope, "from"> & { from: UnsignedEnvelopeFrom };

export const ENVELOPE_VERSION = 1 as const;
export const ENVELOPE_KIND = "agent" as const;
export const URGENCY_VALUES: readonly Urgency[] = ["low", "normal", "high"] as const;
export const TITLE_MAX_CHARS = 120;
export const URI_MAX_CHARS = 256;
