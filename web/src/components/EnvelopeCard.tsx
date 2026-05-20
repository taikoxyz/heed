import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import {
  recoverEnvelopeSigner,
  type Envelope,
  type MailEvent,
} from "@heed/core";
import { resolveUri, type ResolvedIdentity } from "../lib/uri";
import { getEffectiveConfig } from "../lib/settings";

const URGENCY_BADGE: Record<Envelope["urgency"], string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-red-50 text-red-700",
};

export function EnvelopeCard({ envelope, mail }: { envelope: Envelope; mail: MailEvent }) {
  const [identity, setIdentity] = useState<ResolvedIdentity | null>(null);
  const [signerCheck, setSignerCheck] = useState<"pending" | "match" | "mismatch" | "error">("pending");

  useEffect(() => {
    let cancelled = false;
    const cfg = getEffectiveConfig();
    void (async () => {
      try {
        const recovered = await recoverEnvelopeSigner({
          envelope,
          chainId: cfg.chainId,
          verifyingContract: cfg.contractAddress,
        });
        if (!cancelled) {
          setSignerCheck(recovered.toLowerCase() === mail.sender.toLowerCase() ? "match" : "mismatch");
        }
      } catch {
        if (!cancelled) setSignerCheck("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelope, mail.sender]);

  useEffect(() => {
    if (!envelope.from.uri) {
      setIdentity(null);
      return;
    }
    let cancelled = false;
    const cfg = getEffectiveConfig();
    const client = createPublicClient({ chain: taiko, transport: http(cfg.rpcUrl) });
    void resolveUri(envelope.from.uri, { client }).then((r) => {
      if (!cancelled) setIdentity(r);
    });
    return () => {
      cancelled = true;
    };
  }, [envelope.from.uri]);

  const signerLabel = signerCheck === "match" ? "✓ signature matches sender" : signerCheck === "mismatch" ? "⚠ signer does not match sender wallet" : signerCheck === "error" ? "⚠ signature could not be verified" : "verifying signature…";

  return (
    <article className="space-y-2 rounded-md border border-gray-200 p-3 bg-white">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-sm">{envelope.from.name || mailSenderShort(mail)}</span>
        {envelope.from.owner_url && (
          <a className="text-xs text-blue-700 hover:underline" href={envelope.from.owner_url} target="_blank" rel="noreferrer noopener">
            {hostnameOf(envelope.from.owner_url)}
          </a>
        )}
        {identity && (
          <span
            className={`text-xs rounded-full px-2 py-0.5 ${identity.verified ? "bg-green-100 text-green-800" : "bg-amber-50 text-amber-700"}`}
            title={identity.description ?? identity.raw}
          >
            {identity.verified ? "✓ " : "○ "}
            {identity.source === "erc8004" ? "erc-8004" : identity.source === "https" ? "https" : "uri"} ·{" "}
            {identity.display_name ?? identity.raw}
          </span>
        )}
        <span className={`text-xs rounded-full px-2 py-0.5 ${URGENCY_BADGE[envelope.urgency]}`}>{envelope.urgency}</span>
      </header>

      <h3 className="text-base font-medium leading-tight">{envelope.title}</h3>

      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{envelope.body}</pre>

      {envelope.action_url && (
        <a
          href={envelope.action_url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-1.5"
        >
          {hostnameOf(envelope.action_url)} →
        </a>
      )}

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 pt-1">
        <span>sent {formatTimestamp(envelope.sent_at)}</span>
        <span title={mail.sender} className="font-mono">from {mailSenderShort(mail)}</span>
        <span>fee {mail.valueGwei} gwei</span>
        {envelope.reply_to && (
          <span title={envelope.reply_to} className="font-mono">in reply to {envelope.reply_to.slice(0, 10)}…</span>
        )}
        <span className={signerCheck === "match" ? "text-green-700" : signerCheck === "mismatch" || signerCheck === "error" ? "text-red-600" : ""}>{signerLabel}</span>
      </footer>
    </article>
  );
}

function mailSenderShort(mail: MailEvent): string {
  return `${mail.sender.slice(0, 6)}…${mail.sender.slice(-4)}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatTimestamp(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
