import { useAccount, useSignTypedData, useWalletClient } from "wagmi";
import { createPublicClient, http, bytesToHex, type Address } from "viem";
import { taiko } from "viem/chains";
import {
  cidToDigest,
  createReadClient,
  createWriteClient,
  deriveX25519Public,
  encodePlaintext,
  encryptForRecipients,
  KEY_TYPED_DATA,
  pinJson,
  type PlaintextPayload,
} from "@heed/core";
import { getCachedKey, putKey } from "../lib/keys";
import { getEffectiveConfig } from "../lib/settings";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface SendMailInput {
  to: Address[];
  cc?: Address[];
  subject: string;
  body: string;
  inReplyTo?: string;
  onProgress?: (stage: SendStage) => void;
}

export type SendStage =
  | "lookup"
  | "derive-key"
  | "encrypt"
  | "pin"
  | "submit"
  | "confirm";

export interface SendMailResult {
  txHash: `0x${string}`;
  cid: string;
  contentRef: `0x${string}`;
  encrypted: boolean;
  recipients: Address[];
  totalFeeGwei: number;
}

function uniqueAddresses(addrs: Address[]): Address[] {
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const a of addrs) {
    const k = a.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

export function useSendMail() {
  const { address: sender } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signTypedDataAsync } = useSignTypedData();

  return async function send(input: SendMailInput): Promise<SendMailResult> {
    if (!sender) throw new Error("connect a wallet first");
    if (!walletClient) throw new Error("wallet not ready");

    const cfg = getEffectiveConfig();
    if (!cfg.pinataJwt) {
      throw new Error("set a Pinata JWT in Settings to send mail");
    }

    const to = input.to;
    const cc = input.cc ?? [];
    const recipients = uniqueAddresses([...to, ...cc]);
    if (recipients.length === 0) throw new Error("add at least one recipient");

    const publicClient = createPublicClient({
      chain: taiko,
      transport: http(cfg.rpcUrl),
    });
    const reader = createReadClient(publicClient, cfg.contractAddress);

    input.onProgress?.("lookup");
    const inboxes = await reader.getInboxes(recipients);

    const fees: number[] = [];
    let allHaveKeys = true;
    for (let i = 0; i < recipients.length; i++) {
      const inbox = inboxes[i]!;
      const fee = Number(inbox.feeGwei);
      fees.push(fee);
      if (cfg.maxFeeGwei > 0 && fee > cfg.maxFeeGwei) {
        throw new Error(
          `recipient ${recipients[i]} charges ${fee} gwei, above your max of ${cfg.maxFeeGwei} gwei (Settings → Max anti-spam fee)`,
        );
      }
      const key = inbox.keys[0];
      if (!key || key.pub === ZERO_BYTES32) allHaveKeys = false;
    }
    const totalFeeGwei = fees.reduce((a, b) => a + b, 0);

    const payload: PlaintextPayload = {
      v: 1,
      kind: "mail",
      from: sender,
      to,
      cc,
      date: Math.floor(Date.now() / 1000),
      msgId: crypto.randomUUID(),
      subject: input.subject,
      body: { text: input.body },
      attachments: [],
      ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
    };

    let pinTarget: unknown;
    if (allHaveKeys) {
      input.onProgress?.("derive-key");
      const senderInbox = await reader.getInbox(sender);
      const senderHasKey =
        senderInbox.keys[0] && senderInbox.keys[0].pub !== ZERO_BYTES32;
      const senderKeyNonce = senderHasKey
        ? Number(senderInbox.keys[0]!.keyNonce)
        : 0;

      let senderSk = getCachedKey(sender, senderKeyNonce);
      if (!senderSk) {
        const sig = await signTypedDataAsync({
          domain: KEY_TYPED_DATA.domain(cfg.chainId, cfg.contractAddress),
          types: KEY_TYPED_DATA.types,
          primaryType: KEY_TYPED_DATA.primaryType,
          message: KEY_TYPED_DATA.message(senderKeyNonce),
        });
        senderSk = putKey(sender, senderKeyNonce, sig);
      }
      const senderPub = deriveX25519Public(senderSk);

      input.onProgress?.("encrypt");
      pinTarget = encryptForRecipients(encodePlaintext(payload), [
        ...recipients.map((rcpt, i) => ({
          rcpt,
          keyNonce: Number(inboxes[i]!.keys[0]!.keyNonce),
          pub: hexToBytes(inboxes[i]!.keys[0]!.pub),
        })),
        { rcpt: sender, keyNonce: senderKeyNonce, pub: senderPub },
      ]);
    } else {
      pinTarget = payload;
    }

    input.onProgress?.("pin");
    const cid = await pinJson(pinTarget, `heed-mail-${payload.msgId}.json`, {
      jwt: cfg.pinataJwt,
    });
    const digest = cidToDigest(cid);
    const contentRef = bytesToHex(digest);

    input.onProgress?.("submit");
    const writer = createWriteClient(walletClient, cfg.contractAddress);
    const txHash = await writer.sendBatch(
      recipients.map((recipient, i) => ({
        recipient,
        valueGwei: fees[i]!,
        contentRef,
      })),
      false,
      BigInt(totalFeeGwei) * 1_000_000_000n,
    );

    input.onProgress?.("confirm");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    if (receipt.status !== "success") {
      throw new Error(`transaction reverted (${txHash})`);
    }

    return {
      txHash,
      cid,
      contentRef,
      encrypted: allHaveKeys,
      recipients,
      totalFeeGwei,
    };
  };
}

function hexToBytes(h: string): Uint8Array {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
