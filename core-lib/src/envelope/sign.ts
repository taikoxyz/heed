import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import type { Envelope, UnsignedEnvelope } from "./schema";

const ZERO_BYTES32: Hex = `0x${"00".repeat(32)}`;

export const ENVELOPE_TYPED_DATA = {
  domain: (chainId: number, verifyingContract: Address) =>
    ({ name: "Heed", version: "1", chainId, verifyingContract }) as const,
  types: {
    Envelope: [
      { name: "v", type: "uint8" },
      { name: "kind", type: "string" },
      { name: "from", type: "EnvelopeFrom" },
      { name: "title", type: "string" },
      { name: "body", type: "string" },
      { name: "urgency", type: "string" },
      { name: "actionUrl", type: "string" },
      { name: "replyTo", type: "bytes32" },
      { name: "sentAt", type: "uint64" },
    ],
    EnvelopeFrom: [
      { name: "name", type: "string" },
      { name: "ownerUrl", type: "string" },
      { name: "logoCid", type: "string" },
      { name: "uri", type: "string" },
    ],
  } as const,
  primaryType: "Envelope" as const,
  message: (env: Envelope | UnsignedEnvelope) =>
    ({
      v: env.v,
      kind: env.kind,
      from: {
        name: env.from.name,
        ownerUrl: env.from.owner_url,
        logoCid: env.from.logo_cid ?? "",
        uri: env.from.uri ?? "",
      },
      title: env.title,
      body: env.body,
      urgency: env.urgency,
      actionUrl: env.action_url ?? "",
      replyTo: env.reply_to ?? ZERO_BYTES32,
      sentAt: BigInt(env.sent_at),
    }) as const,
};

export type EnvelopeTypedData = {
  domain: ReturnType<typeof ENVELOPE_TYPED_DATA.domain>;
  types: typeof ENVELOPE_TYPED_DATA.types;
  primaryType: typeof ENVELOPE_TYPED_DATA.primaryType;
  message: ReturnType<typeof ENVELOPE_TYPED_DATA.message>;
};

export type EnvelopeSigner = (typedData: EnvelopeTypedData) => Promise<Hex>;

export function envelopeTypedData(args: {
  envelope: Envelope | UnsignedEnvelope;
  chainId: number;
  verifyingContract: Address;
}): EnvelopeTypedData {
  return {
    domain: ENVELOPE_TYPED_DATA.domain(args.chainId, args.verifyingContract),
    types: ENVELOPE_TYPED_DATA.types,
    primaryType: ENVELOPE_TYPED_DATA.primaryType,
    message: ENVELOPE_TYPED_DATA.message(args.envelope),
  };
}

export async function signEnvelope(args: {
  envelope: UnsignedEnvelope;
  chainId: number;
  verifyingContract: Address;
  signer: EnvelopeSigner;
}): Promise<Envelope> {
  const sig = await args.signer(envelopeTypedData(args));
  return { ...args.envelope, from: { ...args.envelope.from, sig } } as Envelope;
}

export async function recoverEnvelopeSigner(args: {
  envelope: Envelope;
  chainId: number;
  verifyingContract: Address;
}): Promise<Address> {
  const td = envelopeTypedData(args);
  return await recoverTypedDataAddress({ ...td, signature: args.envelope.from.sig });
}

export async function verifyEnvelopeSignature(args: {
  envelope: Envelope;
  expectedSigner: Address;
  chainId: number;
  verifyingContract: Address;
}): Promise<boolean> {
  const recovered = await recoverEnvelopeSigner(args);
  return recovered.toLowerCase() === args.expectedSigner.toLowerCase();
}
