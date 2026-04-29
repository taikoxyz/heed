import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import {
  ENVELOPE_TYPED_DATA,
  envelopeTypedData,
  signEnvelope,
  recoverEnvelopeSigner,
  verifyEnvelopeSignature,
} from "../../src/envelope/sign";
import type { Envelope, UnsignedEnvelope } from "../../src/envelope/schema";

const CONTRACT = "0x08f32278B2CFD962444ae9541122eD84cc745678" as const;
const CHAIN_ID = 167000;
const PRIV: Hex = `0x${"1".repeat(64)}`;
const OTHER_PRIV: Hex = `0x${"2".repeat(64)}`;
const ZERO_BYTES32: Hex = `0x${"00".repeat(32)}`;

function unsignedFixture(overrides: Partial<UnsignedEnvelope> = {}): UnsignedEnvelope {
  return {
    v: 1,
    kind: "agent",
    from: { name: "Alice Bot", owner_url: "https://acme.example" },
    title: "build green",
    body: "ready to deploy",
    urgency: "normal",
    sent_at: 1735689600,
    ...overrides,
  } as UnsignedEnvelope;
}

function viemSigner(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return async (typedData: Parameters<typeof account.signTypedData>[0]) =>
    await account.signTypedData(typedData);
}

describe("envelopeTypedData", () => {
  it("produces an EIP-712 structure with per-field types under primaryType=Envelope", () => {
    const td = envelopeTypedData({
      envelope: unsignedFixture(),
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    });
    expect(td.domain).toEqual({
      name: "Heed",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    });
    expect(td.primaryType).toBe("Envelope");
    expect(td.types.Envelope.map((f) => f.name)).toEqual([
      "v",
      "kind",
      "from",
      "title",
      "body",
      "urgency",
      "actionUrl",
      "replyTo",
      "sentAt",
    ]);
    expect(td.types.EnvelopeFrom.map((f) => f.name)).toEqual([
      "name",
      "ownerUrl",
      "logoCid",
      "uri",
    ]);
  });

  it("defaults missing optional fields to '' / zero bytes32 in the EIP-712 message", () => {
    const td = envelopeTypedData({
      envelope: unsignedFixture(),
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    });
    expect(td.message.from.logoCid).toBe("");
    expect(td.message.from.uri).toBe("");
    expect(td.message.actionUrl).toBe("");
    expect(td.message.replyTo).toBe(ZERO_BYTES32);
  });

  it("maps snake_case envelope fields to camelCase EIP-712 fields", () => {
    const env = unsignedFixture({
      from: {
        name: "Claude",
        owner_url: "https://claude.com",
        logo_cid: "bafy...logo",
        uri: "erc8004:taiko:42",
      },
      action_url: "https://app.example/approve",
      reply_to: ("0x" + "ab".repeat(32)) as Hex,
    });
    const td = envelopeTypedData({
      envelope: env,
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    });
    expect(td.message.from.ownerUrl).toBe("https://claude.com");
    expect(td.message.from.logoCid).toBe("bafy...logo");
    expect(td.message.from.uri).toBe("erc8004:taiko:42");
    expect(td.message.actionUrl).toBe("https://app.example/approve");
    expect(td.message.replyTo).toBe(("0x" + "ab".repeat(32)) as Hex);
    expect(td.message.sentAt).toBe(BigInt(env.sent_at));
  });

  it("re-exports the typed data builder constants for tooling", () => {
    expect(ENVELOPE_TYPED_DATA.primaryType).toBe("Envelope");
    expect(ENVELOPE_TYPED_DATA.domain(1, CONTRACT).name).toBe("Heed");
  });
});

describe("signEnvelope / verifyEnvelopeSignature", () => {
  it("round-trips a signature back to the signing address", async () => {
    const account = privateKeyToAccount(PRIV);
    const signed = await signEnvelope({
      envelope: unsignedFixture(),
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
      signer: viemSigner(PRIV),
    });
    expect(signed.from.sig).toMatch(/^0x[0-9a-f]+$/i);
    const recovered = await recoverEnvelopeSigner({
      envelope: signed,
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
    expect(
      await verifyEnvelopeSignature({
        envelope: signed,
        expectedSigner: account.address,
        chainId: CHAIN_ID,
        verifyingContract: CONTRACT,
      }),
    ).toBe(true);
  });

  it("fails verification when any signed field is tampered", async () => {
    const account = privateKeyToAccount(PRIV);
    const signed = await signEnvelope({
      envelope: unsignedFixture(),
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
      signer: viemSigner(PRIV),
    });
    for (const tampered of [
      { ...signed, body: "different body" } as Envelope,
      { ...signed, title: "different title" } as Envelope,
      { ...signed, urgency: "high" } as Envelope,
      { ...signed, sent_at: signed.sent_at + 1 } as Envelope,
      { ...signed, from: { ...signed.from, name: "different" } } as Envelope,
      { ...signed, from: { ...signed.from, owner_url: "https://other" } } as Envelope,
    ]) {
      expect(
        await verifyEnvelopeSignature({
          envelope: tampered,
          expectedSigner: account.address,
          chainId: CHAIN_ID,
          verifyingContract: CONTRACT,
        }),
      ).toBe(false);
    }
  });

  it("fails verification when domain (chainId or contract) differs", async () => {
    const account = privateKeyToAccount(PRIV);
    const signed = await signEnvelope({
      envelope: unsignedFixture(),
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
      signer: viemSigner(PRIV),
    });
    expect(
      await verifyEnvelopeSignature({
        envelope: signed,
        expectedSigner: account.address,
        chainId: CHAIN_ID + 1,
        verifyingContract: CONTRACT,
      }),
    ).toBe(false);
    expect(
      await verifyEnvelopeSignature({
        envelope: signed,
        expectedSigner: account.address,
        chainId: CHAIN_ID,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      }),
    ).toBe(false);
  });

  it("fails verification when the wrong signer is expected", async () => {
    const otherAccount = privateKeyToAccount(OTHER_PRIV);
    const signed = await signEnvelope({
      envelope: unsignedFixture(),
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
      signer: viemSigner(PRIV),
    });
    expect(
      await verifyEnvelopeSignature({
        envelope: signed,
        expectedSigner: otherAccount.address,
        chainId: CHAIN_ID,
        verifyingContract: CONTRACT,
      }),
    ).toBe(false);
  });

  it("preserves verification across a JSON encode/decode round-trip on the wire", async () => {
    const account = privateKeyToAccount(PRIV);
    const signed = await signEnvelope({
      envelope: unsignedFixture(),
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
      signer: viemSigner(PRIV),
    });
    const wire = JSON.parse(JSON.stringify(signed)) as Envelope;
    expect(
      await verifyEnvelopeSignature({
        envelope: wire,
        expectedSigner: account.address,
        chainId: CHAIN_ID,
        verifyingContract: CONTRACT,
      }),
    ).toBe(true);
  });
});
