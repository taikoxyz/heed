import { describe, it, expect, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, type Address, type Hash, type Hex } from "viem";
import {
  decodeEncryptedBytes,
  decodeEnvelope,
  recoverEnvelopeSigner,
  cidToDigest,
  digestToCid,
} from "@heed/core";
import {
  buildSignedEnvelope,
  runSend,
  runSendDryRun,
  type DeliveryReceipt,
  type SendArgs,
  type SendDeps,
  type RecipientKey,
} from "../../src/lib/send";
import { CliError } from "../../src/lib/errors";
import { defaultConfig, type HeedConfig } from "../../src/config/store";

const PK: Hex = `0x${"a".repeat(64)}`;
const TO: Address = ("0x" + "B".repeat(40)) as Address;
const FAKE_TX: Hash = `0x${"f".repeat(64)}`;
const FROZEN_NOW = 1735689600_000;

function configWithIdentity(
  overrides: Partial<HeedConfig["identity"]> = {},
): HeedConfig {
  return {
    ...defaultConfig(),
    network: { ...defaultConfig().network, rpc_url: "http://localhost" },
    identity: {
      name: "Alice Bot",
      owner_url: "https://acme.example",
      ...overrides,
    },
  };
}

function recipientWithKey(): { key: RecipientKey; sk: Uint8Array } {
  const sk = x25519.utils.randomPrivateKey();
  const pub = x25519.getPublicKey(sk);
  return { key: { pub: bytesToHex(pub), keyNonce: 1, feeGwei: 100 }, sk };
}

function pinAsRealCid(bytes: Uint8Array): string {
  return digestToCid(sha256(bytes));
}

function makeDeps(args: {
  config: HeedConfig;
  recipient: RecipientKey;
  pin?: SendDeps["pin"];
  sendBatch?: SendDeps["sendBatch"];
}): SendDeps {
  return {
    privateKey: PK,
    config: args.config,
    lookupRecipient: async () => args.recipient,
    pin: args.pin ?? (async (bytes) => pinAsRealCid(bytes)),
    sendBatch: args.sendBatch ?? (async () => ({ txHash: FAKE_TX })),
    now: () => FROZEN_NOW,
  };
}

describe("buildSignedEnvelope", () => {
  it("produces an envelope whose signature recovers to the wallet address", async () => {
    const config = configWithIdentity();
    const signed = await buildSignedEnvelope({
      send: { to: TO, title: "t", body: "b", urgency: "normal" },
      privateKey: PK,
      config,
      now: () => FROZEN_NOW,
    });
    const recovered = await recoverEnvelopeSigner({
      envelope: signed,
      chainId: config.network.chain_id,
      verifyingContract: config.network.contract,
    });
    expect(recovered).toBeDefined();
    expect(signed.from.name).toBe("Alice Bot");
    expect(signed.from.owner_url).toBe("https://acme.example");
    expect(signed.sent_at).toBe(Math.floor(FROZEN_NOW / 1000));
  });

  it("populates optional from.uri / from.logo_cid when set in identity", async () => {
    const signed = await buildSignedEnvelope({
      send: {
        to: TO,
        title: "t",
        body: "b",
        urgency: "high",
        actionUrl: "https://app.example/x",
      },
      privateKey: PK,
      config: configWithIdentity({
        uri: "erc8004:taiko:42",
        logo_cid: "bafy...",
      }),
      now: () => FROZEN_NOW,
    });
    expect(signed.from.uri).toBe("erc8004:taiko:42");
    expect(signed.from.logo_cid).toBe("bafy...");
    expect(signed.action_url).toBe("https://app.example/x");
    expect(signed.urgency).toBe("high");
  });

  it("omits empty identity strings (does not emit empty logo_cid / uri)", async () => {
    const signed = await buildSignedEnvelope({
      send: { to: TO, title: "t", body: "b", urgency: "normal" },
      privateKey: PK,
      config: configWithIdentity({ uri: "", logo_cid: "" }),
      now: () => FROZEN_NOW,
    });
    expect(signed.from.uri).toBeUndefined();
    expect(signed.from.logo_cid).toBeUndefined();
  });
});

describe("runSend", () => {
  it("returns a tx hash, contentRef, and CID, and pins / sends with the right args", async () => {
    const { key } = recipientWithKey();
    const pinFn = vi.fn<SendDeps["pin"]>(async (bytes) => pinAsRealCid(bytes));
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
    }));
    const result = await runSend(
      { to: TO, title: "deploy?", body: "ready", urgency: "normal" },
      makeDeps({
        config: configWithIdentity(),
        recipient: key,
        pin: pinFn,
        sendBatch: sendFn,
      }),
    );
    expect(result.txHash).toBe(FAKE_TX);
    expect(result.cid).toMatch(/^baf/);
    expect(result.contentRef).toBe(bytesToHex(cidToDigest(result.cid)));
    expect(result.feeGwei).toBe(100);
    expect(pinFn).toHaveBeenCalledTimes(1);
    const sendCall = sendFn.mock.calls[0]![0];
    expect(sendCall.mails[0]!.recipient).toBe(TO);
    expect(sendCall.mails[0]!.valueGwei).toBe(100);
    expect(sendCall.totalValueWei).toBe(100n * 10n ** 9n);
  });

  it("defaults to atomic + wait so a single-recipient send is deterministic", async () => {
    const { key } = recipientWithKey();
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
    }));
    await runSend(
      { to: TO, title: "t", body: "b", urgency: "normal" },
      makeDeps({
        config: configWithIdentity(),
        recipient: key,
        sendBatch: sendFn,
      }),
    );
    const call = sendFn.mock.calls[0]![0];
    expect(call.atomic).toBe(true);
    expect(call.wait).toBe(true);
  });

  it("--best-effort opt-out flips atomic=false (wait stays on)", async () => {
    const { key } = recipientWithKey();
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
    }));
    await runSend(
      { to: TO, title: "t", body: "b", urgency: "normal", atomic: false },
      makeDeps({
        config: configWithIdentity(),
        recipient: key,
        sendBatch: sendFn,
      }),
    );
    expect(sendFn.mock.calls[0]![0].atomic).toBe(false);
  });

  it("--no-wait flips wait=false and the result has no receipt", async () => {
    const { key } = recipientWithKey();
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
    }));
    const result = await runSend(
      { to: TO, title: "t", body: "b", urgency: "normal", wait: false },
      makeDeps({
        config: configWithIdentity(),
        recipient: key,
        sendBatch: sendFn,
      }),
    );
    expect(sendFn.mock.calls[0]![0].wait).toBe(false);
    expect(result.receipt).toBeUndefined();
  });

  it("propagates the delivery receipt when wait=true and the tx succeeded", async () => {
    const { key } = recipientWithKey();
    const receipt: DeliveryReceipt = {
      status: "success",
      blockNumber: 123n,
      gasUsed: 50_000n,
      totalCostWei: 100n * 10n ** 9n + 50_000n,
      delivered: true,
    };
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
      receipt,
    }));
    const result = await runSend(
      { to: TO, title: "t", body: "b", urgency: "normal" },
      makeDeps({
        config: configWithIdentity(),
        recipient: key,
        sendBatch: sendFn,
      }),
    );
    expect(result.receipt).toEqual(receipt);
  });

  it("throws DELIVERY_FAILED when wait observes a reverted tx", async () => {
    const { key } = recipientWithKey();
    const receipt: DeliveryReceipt = {
      status: "reverted",
      blockNumber: 1n,
      gasUsed: 21_000n,
      totalCostWei: 21_000n,
      delivered: false,
    };
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
      receipt,
    }));
    await expect(
      runSend(
        { to: TO, title: "t", body: "b", urgency: "normal" },
        makeDeps({
          config: configWithIdentity(),
          recipient: key,
          sendBatch: sendFn,
        }),
      ),
    ).rejects.toMatchObject({ code: "DELIVERY_FAILED" });
  });

  it("throws DELIVERY_FAILED when the tx succeeded but no MailSent event was emitted (delivered=false)", async () => {
    const { key } = recipientWithKey();
    const receipt: DeliveryReceipt = {
      status: "success",
      blockNumber: 9n,
      gasUsed: 21_000n,
      totalCostWei: 21_000n,
      delivered: false,
    };
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
      receipt,
    }));
    await expect(
      runSend(
        { to: TO, title: "t", body: "b", urgency: "normal" },
        makeDeps({
          config: configWithIdentity(),
          recipient: key,
          sendBatch: sendFn,
        }),
      ),
    ).rejects.toMatchObject({ code: "DELIVERY_FAILED" });
  });

  it("refuses with FEE_EXCEEDS_MAX when recipient fee > maxFeeGwei (no pin, no send)", async () => {
    const { key } = recipientWithKey();
    const pinFn = vi.fn<SendDeps["pin"]>(async () => "should not be called");
    const sendFn = vi.fn<SendDeps["sendBatch"]>(async () => ({
      txHash: FAKE_TX,
    }));
    await expect(
      runSend(
        { to: TO, title: "t", body: "b", urgency: "normal", maxFeeGwei: 50 },
        makeDeps({
          config: configWithIdentity(),
          recipient: key,
          pin: pinFn,
          sendBatch: sendFn,
        }),
      ),
    ).rejects.toMatchObject({
      code: "FEE_EXCEEDS_MAX",
      details: { feeGwei: 100, maxFeeGwei: 50 },
    });
    expect(pinFn).not.toHaveBeenCalled();
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("passes through when recipient fee is within maxFeeGwei", async () => {
    const { key } = recipientWithKey();
    const result = await runSend(
      { to: TO, title: "t", body: "b", urgency: "normal", maxFeeGwei: 100 },
      makeDeps({ config: configWithIdentity(), recipient: key }),
    );
    expect(result.txHash).toBe(FAKE_TX);
  });

  it("RECIPIENT_NO_KEY is a CliError with the typed code", async () => {
    const noKey: RecipientKey = {
      pub: ("0x" + "00".repeat(32)) as Hex,
      keyNonce: 0,
      feeGwei: 0,
    };
    const promise = runSend(
      { to: TO, title: "t", body: "b", urgency: "normal" },
      makeDeps({ config: configWithIdentity(), recipient: noKey }),
    );
    await expect(promise).rejects.toBeInstanceOf(CliError);
    await expect(promise).rejects.toMatchObject({ code: "RECIPIENT_NO_KEY" });
  });

  it("encrypts to the recipient's public key, and the recipient can decrypt + verify", async () => {
    const { key, sk } = recipientWithKey();
    let pinned: Uint8Array | undefined;
    const config = configWithIdentity({ uri: "erc8004:taiko:42" });
    const deps = makeDeps({
      config,
      recipient: key,
      pin: async (bytes) => {
        pinned = bytes;
        return pinAsRealCid(bytes);
      },
    });
    const result = await runSend(
      { to: TO, title: "hello", body: "world", urgency: "normal" },
      deps,
    );
    expect(pinned).toBeDefined();
    const inner = decodeEncryptedBytes(pinned!, {
      rcpt: TO,
      keyNonce: key.keyNonce,
      sk,
    });
    const decoded = decodeEnvelope(inner);
    expect(decoded).toEqual(result.signedEnvelope);
    const recovered = await recoverEnvelopeSigner({
      envelope: decoded,
      chainId: config.network.chain_id,
      verifyingContract: config.network.contract,
    });
    expect(recovered).toBeDefined();
  });

  it("throws when the recipient has not published an encryption key", async () => {
    const config = configWithIdentity();
    const noKey: RecipientKey = {
      pub: ("0x" + "00".repeat(32)) as Hex,
      keyNonce: 0,
      feeGwei: 0,
    };
    await expect(
      runSend(
        { to: TO, title: "t", body: "b", urgency: "normal" },
        makeDeps({ config, recipient: noKey }),
      ),
    ).rejects.toThrow(/has not published an encryption key/);
  });

  it("threading: reply_to flows into the signed envelope", async () => {
    const { key } = recipientWithKey();
    const replyTo: Hex = ("0x" + "12".repeat(32)) as Hex;
    const result = await runSend(
      { to: TO, title: "re: deploy?", body: "yes", urgency: "normal", replyTo },
      makeDeps({ config: configWithIdentity(), recipient: key }),
    );
    expect(result.signedEnvelope.reply_to).toBe(replyTo);
  });
});

describe("runSendDryRun", () => {
  it("returns a synthetic CID + contentRef without calling pin or sendBatch", async () => {
    const { key } = recipientWithKey();
    const result = await runSendDryRun(
      { to: TO, title: "t", body: "b", urgency: "normal" },
      {
        privateKey: PK,
        config: configWithIdentity(),
        lookupRecipient: async () => key,
        now: () => FROZEN_NOW,
      },
    );
    expect(result.feeGwei).toBe(100);
    expect(result.cid).toMatch(/^baf/);
    expect(result.contentRef).toBe(bytesToHex(cidToDigest(result.cid)));
    expect(result.encryptedSize).toBeGreaterThan(0);
    expect(result.signedEnvelope.from.name).toBe("Alice Bot");
  });

  it("still surfaces the no-key error during dry run", async () => {
    const noKey: RecipientKey = {
      pub: ("0x" + "00".repeat(32)) as Hex,
      keyNonce: 0,
      feeGwei: 0,
    };
    await expect(
      runSendDryRun(
        { to: TO, title: "t", body: "b", urgency: "normal" },
        {
          privateKey: PK,
          config: configWithIdentity(),
          lookupRecipient: async () => noKey,
          now: () => FROZEN_NOW,
        },
      ),
    ).rejects.toThrow(/has not published an encryption key/);
  });
});
