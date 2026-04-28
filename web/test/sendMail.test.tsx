import { describe, it, expect } from "vitest";
import {
  decodeEncrypted,
  deriveX25519Private,
  deriveX25519Public,
  encodePlaintext,
  encryptForRecipients,
  type PlaintextPayload,
} from "@heed/core";

describe("compose dual-lockbox invariant", () => {
  it("an encrypted payload with sender + recipient lockboxes is decryptable by both", () => {
    const senderSig = new Uint8Array(64).fill(0xaa);
    const senderSk = deriveX25519Private(senderSig);
    const senderPub = deriveX25519Public(senderSk);
    const senderAddr = "0x1111111111111111111111111111111111111111" as const;
    const senderKeyNonce = 0;

    const rcptSig = new Uint8Array(64).fill(0xbb);
    const rcptSk = deriveX25519Private(rcptSig);
    const rcptPub = deriveX25519Public(rcptSk);
    const rcptAddr = "0x2222222222222222222222222222222222222222" as const;
    const rcptKeyNonce = 1;

    const payload: PlaintextPayload = {
      v: 1,
      kind: "mail",
      from: senderAddr,
      to: [rcptAddr],
      cc: [],
      date: 1714000000,
      msgId: "test-1",
      subject: "hello",
      body: { text: "hi from sender" },
      attachments: [],
    };

    const envelope = encryptForRecipients(encodePlaintext(payload), [
      { rcpt: rcptAddr, keyNonce: rcptKeyNonce, pub: rcptPub },
      { rcpt: senderAddr, keyNonce: senderKeyNonce, pub: senderPub },
    ]);

    const bytes = new TextEncoder().encode(JSON.stringify(envelope));

    const fromRcpt = decodeEncrypted(bytes, {
      rcpt: rcptAddr,
      keyNonce: rcptKeyNonce,
      sk: rcptSk,
    });
    expect(fromRcpt).toEqual(payload);

    const fromSender = decodeEncrypted(bytes, {
      rcpt: senderAddr,
      keyNonce: senderKeyNonce,
      sk: senderSk,
    });
    expect(fromSender).toEqual(payload);

    expect(envelope.lockboxes).toHaveLength(2);
    const recipients = envelope.lockboxes.map((l) => l.rcpt);
    expect(recipients).toContain(senderAddr);
    expect(recipients).toContain(rcptAddr);
  });
});
