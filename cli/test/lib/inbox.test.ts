import { describe, it, expect, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, type Address, type Hex } from "viem";
import {
  encodeEnvelope,
  encodeEncryptedBytes,
  encodePlaintext,
  signEnvelope,
  digestToCid,
  type Envelope,
  type MailEvent,
  type PlaintextPayload,
} from "@heed/core";
import { privateKeyToAccount } from "viem/accounts";
import { hydrateMessage, runInboxList, watchInbox, type InboxDeps } from "../../src/lib/inbox";

const RECIPIENT_PK: Hex = `0x${"a".repeat(64)}`;
const SENDER_PK: Hex = `0x${"b".repeat(64)}`;
const RECIPIENT = privateKeyToAccount(RECIPIENT_PK).address;
const SENDER = privateKeyToAccount(SENDER_PK).address;
const CHAIN_ID = 167000;
const CONTRACT: Address = "0x08f32278B2CFD962444ae9541122eD84cc745678";
const KEY_NONCE = 1;

function recipientKeys(): { pub: Uint8Array; sk: Uint8Array } {
  const sk = x25519.utils.randomPrivateKey();
  return { sk, pub: x25519.getPublicKey(sk) };
}

async function buildSignedEnvelopeFixture(): Promise<Envelope> {
  return await signEnvelope({
    envelope: {
      v: 1,
      kind: "agent",
      from: { name: "Alice Bot", owner_url: "https://acme.example" },
      title: "deploy?",
      body: "ready when you are",
      urgency: "normal",
      sent_at: 1735689600,
    },
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT,
    signer: async (typedData) => privateKeyToAccount(SENDER_PK).signTypedData(typedData),
  });
}

function makeEvent(contentRef: Hex, sender: Address = SENDER): MailEvent {
  return {
    txHash: ("0x" + "1".repeat(64)) as Hex,
    blockNumber: 100n,
    blockTimestamp: 1735689600n,
    sender,
    recipient: RECIPIENT,
    contentRef,
    valueGwei: 100,
  };
}

function depsFor(args: {
  sk: Uint8Array;
  cid: string;
  encrypted: Uint8Array;
  events: MailEvent[];
  watchInboxImpl?: InboxDeps["watchInbox"];
}): InboxDeps {
  const expectedRef: Hex = bytesToHex(sha256(args.encrypted));
  return {
    walletAddress: RECIPIENT,
    encryptionKeyNonce: KEY_NONCE,
    encryptionPriv: args.sk,
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT,
    listInbox: async () => args.events,
    ...(args.watchInboxImpl ? { watchInbox: args.watchInboxImpl } : {}),
    fetchByContentRef: async (contentRef) => {
      if (contentRef !== expectedRef) throw new Error(`unexpected contentRef ${contentRef}`);
      return args.encrypted;
    },
  };
}

describe("hydrateMessage", () => {
  it("decrypts an envelope and verifies the signer matches the chain sender", async () => {
    const { sk, pub } = recipientKeys();
    const env = await buildSignedEnvelopeFixture();
    const inner = encodeEnvelope(env);
    const encrypted = encodeEncryptedBytes(inner, [{ rcpt: RECIPIENT, keyNonce: KEY_NONCE, pub }]);
    const contentRef: Hex = bytesToHex(sha256(encrypted));
    const cid = digestToCid(hexToBytes(contentRef));

    const event = makeEvent(contentRef);
    const deps = depsFor({ sk, cid, encrypted, events: [event] });

    const msg = await hydrateMessage(event, deps);
    expect(msg.decoded.kind).toBe("envelope");
    if (msg.decoded.kind !== "envelope") throw new Error("expected envelope kind");
    expect(msg.decoded.envelope).toEqual(env);
    expect(msg.signatureValid).toBe(true);
    expect(msg.signerMatchesSender).toBe(true);
    expect(msg.txHash).toBe(event.txHash);
    expect(msg.blockTimestamp).toBe(1735689600);
  });

  it("flags signerMatchesSender=false when the chain sender is not the envelope signer", async () => {
    const { sk, pub } = recipientKeys();
    const env = await buildSignedEnvelopeFixture();
    const encrypted = encodeEncryptedBytes(encodeEnvelope(env), [{ rcpt: RECIPIENT, keyNonce: KEY_NONCE, pub }]);
    const contentRef: Hex = bytesToHex(sha256(encrypted));

    const wrongSender = privateKeyToAccount(("0x" + "c".repeat(64)) as Hex).address;
    const event = makeEvent(contentRef, wrongSender);
    const deps = depsFor({ sk, cid: digestToCid(hexToBytes(contentRef)), encrypted, events: [event] });

    const msg = await hydrateMessage(event, deps);
    expect(msg.signatureValid).toBe(true);
    expect(msg.signerMatchesSender).toBe(false);
  });

  it("decodes legacy mail payloads as kind=mail with no signature fields", async () => {
    const { sk, pub } = recipientKeys();
    const mail: PlaintextPayload = {
      v: 1,
      kind: "mail",
      from: SENDER,
      to: [RECIPIENT],
      cc: [],
      date: 1735689600,
      msgId: "legacy-1",
      subject: "old style",
      body: { text: "before the pivot" },
      attachments: [],
    };
    const encrypted = encodeEncryptedBytes(encodePlaintext(mail), [{ rcpt: RECIPIENT, keyNonce: KEY_NONCE, pub }]);
    const contentRef: Hex = bytesToHex(sha256(encrypted));
    const event = makeEvent(contentRef);
    const deps = depsFor({ sk, cid: digestToCid(hexToBytes(contentRef)), encrypted, events: [event] });

    const msg = await hydrateMessage(event, deps);
    expect(msg.decoded.kind).toBe("mail");
    expect(msg.signatureValid).toBeUndefined();
    expect(msg.signerMatchesSender).toBeUndefined();
  });

  it("returns kind=unknown for non-payload bytes", async () => {
    const { sk, pub } = recipientKeys();
    const garbage = new TextEncoder().encode("not a heed payload");
    const encrypted = encodeEncryptedBytes(garbage, [{ rcpt: RECIPIENT, keyNonce: KEY_NONCE, pub }]);
    const contentRef: Hex = bytesToHex(sha256(encrypted));
    const event = makeEvent(contentRef);
    const deps = depsFor({ sk, cid: digestToCid(hexToBytes(contentRef)), encrypted, events: [event] });

    const msg = await hydrateMessage(event, deps);
    expect(msg.decoded.kind).toBe("unknown");
  });

  it("captures decode errors when fetch fails (e.g., gateway 500)", async () => {
    const { sk } = recipientKeys();
    const contentRef: Hex = ("0x" + "ab".repeat(32)) as Hex;
    const event = makeEvent(contentRef);
    const deps: InboxDeps = {
      walletAddress: RECIPIENT,
      encryptionKeyNonce: KEY_NONCE,
      encryptionPriv: sk,
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
      listInbox: async () => [event],
      fetchByContentRef: async () => {
        throw new Error("gateway 500");
      },
    };
    const msg = await hydrateMessage(event, deps);
    expect(msg.decodeError).toMatch(/gateway 500/);
    expect(msg.decoded.kind).toBe("unknown");
  });

  it("captures decryption failures when the recipient's key is wrong", async () => {
    const { pub } = recipientKeys();
    const wrongSk = x25519.utils.randomPrivateKey();
    const encrypted = encodeEncryptedBytes(encodeEnvelope(await buildSignedEnvelopeFixture()), [
      { rcpt: RECIPIENT, keyNonce: KEY_NONCE, pub },
    ]);
    const contentRef: Hex = bytesToHex(sha256(encrypted));
    const event = makeEvent(contentRef);
    const deps = depsFor({ sk: wrongSk, cid: digestToCid(hexToBytes(contentRef)), encrypted, events: [event] });

    const msg = await hydrateMessage(event, deps);
    expect(msg.decodeError).toBeDefined();
  });
});

describe("runInboxList", () => {
  it("hydrates every event from listInbox", async () => {
    const { sk, pub } = recipientKeys();
    const env = await buildSignedEnvelopeFixture();
    const encrypted = encodeEncryptedBytes(encodeEnvelope(env), [{ rcpt: RECIPIENT, keyNonce: KEY_NONCE, pub }]);
    const contentRef: Hex = bytesToHex(sha256(encrypted));
    const events = [makeEvent(contentRef), makeEvent(contentRef)];
    const deps = depsFor({ sk, cid: digestToCid(hexToBytes(contentRef)), encrypted, events });

    const messages = await runInboxList({}, deps);
    expect(messages).toHaveLength(2);
    expect(messages.every((m) => m.decoded.kind === "envelope")).toBe(true);
  });

  it("forwards sinceBlock and limit to listInbox", async () => {
    const { sk } = recipientKeys();
    const listSpy = vi.fn(async () => []);
    const deps: InboxDeps = {
      walletAddress: RECIPIENT,
      encryptionKeyNonce: KEY_NONCE,
      encryptionPriv: sk,
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
      listInbox: listSpy,
      fetchByContentRef: async () => new Uint8Array(),
    };
    await runInboxList({ sinceBlock: 500n, limit: 10 }, deps);
    expect(listSpy).toHaveBeenCalledWith(500n, 10);
  });
});

describe("watchInbox", () => {
  it("invokes onMessage for every new event from the source", async () => {
    const { sk, pub } = recipientKeys();
    const env = await buildSignedEnvelopeFixture();
    const encrypted = encodeEncryptedBytes(encodeEnvelope(env), [{ rcpt: RECIPIENT, keyNonce: KEY_NONCE, pub }]);
    const contentRef: Hex = bytesToHex(sha256(encrypted));
    let capturedHandler: ((event: MailEvent) => void) | null = null;
    const stop = vi.fn();
    const deps = depsFor({
      sk,
      cid: digestToCid(hexToBytes(contentRef)),
      encrypted,
      events: [],
      watchInboxImpl: (handler) => {
        capturedHandler = handler;
        return stop;
      },
    });

    const collected: Array<{ kind: string }> = [];
    const cancel = watchInbox(deps, (msg) => collected.push({ kind: msg.decoded.kind }));
    expect(capturedHandler).toBeTruthy();

    capturedHandler!(makeEvent(contentRef));
    await new Promise((r) => setImmediate(r));

    expect(collected).toEqual([{ kind: "envelope" }]);
    cancel();
    expect(stop).toHaveBeenCalled();
  });
});
