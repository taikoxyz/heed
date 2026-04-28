import { useState } from "react";
import type { MailEvent, PlaintextPayload } from "@heed/core";
import { useMailDecryption } from "../hooks/useMailDecryption";

export function MailCard({ mail }: { mail: MailEvent }) {
  const [content, setContent] = useState<PlaintextPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decrypt = useMailDecryption();

  return (
    <li className="p-4 hover:bg-gray-50">
      <div className="text-sm text-gray-500">
        from <span className="font-mono">{mail.sender}</span>
      </div>
      <div className="text-xs text-gray-500">
        paid {mail.valueGwei} gwei · ref{" "}
        <code>{mail.contentRef.slice(0, 10)}…</code>
      </div>
      {content ? (
        <pre className="mt-2 text-xs whitespace-pre-wrap">
          {JSON.stringify(content, null, 2)}
        </pre>
      ) : (
        <button
          onClick={async () => {
            setError(null);
            try {
              setContent(await decrypt(mail.contentRef));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          className="mt-2 underline text-sm"
        >
          Open
        </button>
      )}
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </li>
  );
}
