import { useState } from "react";
import { isAddress, type Address } from "viem";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createReadClient } from "@heed/core";
import { useSendMail, type SendStage } from "../hooks/useSendMail";
import { getEffectiveConfig } from "../lib/settings";

const STAGE_LABEL: Record<SendStage, string> = {
  lookup: "Looking up recipient…",
  "derive-key": "Deriving sender key…",
  encrypt: "Encrypting…",
  pin: "Pinning to IPFS…",
  submit: "Submitting transaction…",
  confirm: "Waiting for confirmation…",
};

export function Compose() {
  const send = useSendMail();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [feeGwei, setFeeGwei] = useState<number>(0);
  const [feeHint, setFeeHint] = useState<string>("");
  const [plaintextMode, setPlaintextMode] = useState(false);
  const [stage, setStage] = useState<SendStage | null>(null);
  const [result, setResult] = useState<{
    txHash: string;
    cid: string;
    encrypted: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onToBlur() {
    setFeeHint("");
    setPlaintextMode(false);
    if (!isAddress(to)) return;
    try {
      const cfg = getEffectiveConfig();
      const client = createPublicClient({
        chain: taiko,
        transport: http(cfg.rpcUrl),
      });
      const reader = createReadClient(client, cfg.contractAddress);
      const inbox = await reader.getInbox(to as Address);
      setFeeGwei(Number(inbox.feeGwei));
      const hasKey =
        inbox.keys[0] &&
        inbox.keys[0].pub !==
          "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (hasKey) {
        setFeeHint(`Recipient charges ${inbox.feeGwei} gwei.`);
        setPlaintextMode(false);
      } else {
        setFeeHint(
          `Recipient charges ${inbox.feeGwei} gwei. No published encryption key — message will be sent as PLAINTEXT (anyone can read).`,
        );
        setPlaintextMode(true);
      }
    } catch (e) {
      setFeeHint(
        `Could not fetch recipient fee: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function onSend() {
    setError(null);
    setResult(null);
    setBusy(true);
    setStage(null);
    try {
      if (!isAddress(to)) throw new Error("recipient is not a valid address");
      if (!subject.trim() && !body.trim()) {
        throw new Error("subject or body must be non-empty");
      }
      const r = await send({
        recipient: to as Address,
        subject,
        body,
        feeGwei,
        onProgress: setStage,
      });
      setResult({ txHash: r.txHash, cid: r.cid, encrypted: r.encrypted });
      setSubject("");
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <div className="p-4 max-w-xl">
      <h2 className="text-lg mb-4">Compose</h2>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm">To (address)</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            onBlur={onToBlur}
            placeholder="0x…"
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
          />
          {feeHint && (
            <span
              className={`text-xs mt-1 block ${
                plaintextMode ? "text-amber-700" : "text-gray-500"
              }`}
            >
              {feeHint}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full border rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="mt-1 w-full border rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm">Fee (gwei)</span>
          <input
            type="number"
            min={0}
            value={feeGwei || ""}
            onChange={(e) => setFeeGwei(Number(e.target.value) || 0)}
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onSend}
          disabled={busy}
          className="px-4 py-2 border rounded text-sm disabled:opacity-50"
        >
          {busy ? "Sending…" : plaintextMode ? "Send (plaintext)" : "Send"}
        </button>
        {stage && (
          <span className="text-sm text-gray-600">{STAGE_LABEL[stage]}</span>
        )}
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-600 break-words">{error}</div>
      )}

      {result && (
        <div className="mt-4 text-sm space-y-1">
          <div className="text-green-700">
            Sent {result.encrypted ? "(encrypted)" : "(plaintext)"}.
          </div>
          <div className="break-all">
            tx: <code className="text-xs">{result.txHash}</code>
          </div>
          <div className="break-all">
            cid: <code className="text-xs">{result.cid}</code>
          </div>
          <a
            className="underline text-xs"
            href={`https://taikoscan.io/tx/${result.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Taikoscan ↗
          </a>
        </div>
      )}
    </div>
  );
}
