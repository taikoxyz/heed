import type { MailEvent } from "@heed/core";

export function MailCard({ mail }: { mail: MailEvent }) {
  return (
    <li className="p-4 hover:bg-gray-50">
      <div className="text-sm text-gray-500">
        from <span className="font-mono">{mail.sender}</span>
      </div>
      <div className="text-xs text-gray-500">
        paid {mail.valueGwei} gwei · ref{" "}
        <code>{mail.contentRef.slice(0, 10)}…</code>
      </div>
    </li>
  );
}
