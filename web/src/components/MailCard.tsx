import { useState } from "react";
import type { MailEvent, PlaintextPayload } from "@heed/core";
import { useMailDecryption } from "../hooks/useMailDecryption";

export function MailCard({
  mail,
  direction = "received",
}: {
  mail: MailEvent;
  direction?: "received" | "sent";
}) {
  const [content, setContent] = useState<PlaintextPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decrypt = useMailDecryption();

  async function open(force = false) {
    setError(null);
    setBusy(true);
    try {
      setContent(await decrypt(mail.contentRef, { force }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const counterparty = direction === "sent" ? mail.recipient : mail.sender;
  const counterpartyLabel = direction === "sent" ? "to" : "from";

  return (
    <li className="p-4 hover:bg-gray-50">
      <div className="text-sm text-gray-500">
        {counterpartyLabel}{" "}
        <span className="font-mono">{counterparty}</span>
      </div>
      <div className="text-xs text-gray-500">
        {direction === "sent" ? "paid" : "fee"} {mail.valueGwei} gwei · ref{" "}
        <code>{mail.contentRef.slice(0, 10)}…</code>
      </div>

      {content ? (
        <pre className="mt-2 text-xs whitespace-pre-wrap">
          {JSON.stringify(content, null, 2)}
        </pre>
      ) : (
        <button
          onClick={() => open(false)}
          disabled={busy}
          className="mt-2 underline text-sm disabled:opacity-50"
        >
          {busy ? "Decrypting…" : "Open"}
        </button>
      )}

      {error && (
        <div className="mt-1 text-xs text-red-600 space-y-1">
          <div className="break-words">{error}</div>
          <button
            onClick={() => open(true)}
            disabled={busy}
            className="underline text-red-700"
          >
            Re-sign and retry
          </button>
        </div>
      )}
    </li>
  );
}
