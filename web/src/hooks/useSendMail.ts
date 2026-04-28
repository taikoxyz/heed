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
  recipient: Address;
  subject: string;
  body: string;
  feeGwei: number;
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

    const publicClient = createPublicClient({
      chain: taiko,
      transport: http(cfg.rpcUrl),
    });
    const reader = createReadClient(publicClient, cfg.contractAddress);

    input.onProgress?.("lookup");
    const rcptInbox = await reader.getInbox(input.recipient);
    const rcptKey = rcptInbox.keys[0];
    const recipientHasKey = !!rcptKey && rcptKey.pub !== ZERO_BYTES32;

    const payload: PlaintextPayload = {
      v: 1,
      kind: "mail",
      from: sender,
      to: [input.recipient],
      cc: [],
      date: Math.floor(Date.now() / 1000),
      msgId: crypto.randomUUID(),
      subject: input.subject,
      body: { text: input.body },
      attachments: [],
    };

    let pinTarget: unknown;
    if (recipientHasKey) {
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
        {
          rcpt: input.recipient,
          keyNonce: Number(rcptKey!.keyNonce),
          pub: hexToBytes(rcptKey!.pub),
        },
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
      [
        {
          recipient: input.recipient,
          valueGwei: input.feeGwei,
          contentRef,
        },
      ],
      false,
      BigInt(input.feeGwei) * 1_000_000_000n,
    );

    input.onProgress?.("confirm");
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { txHash, cid, contentRef, encrypted: recipientHasKey };
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
