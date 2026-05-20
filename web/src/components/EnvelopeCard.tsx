import { useEffect, useState } from "react";
import {
  recoverEnvelopeSigner,
  type Envelope,
  type MailEvent,
} from "@heed/core";
import { resolveUri, type ResolvedIdentity } from "../lib/uri";
import { getEffectiveConfig } from "../lib/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const URGENCY_VARIANT: Record<
  Envelope["urgency"],
  "secondary" | "outline" | "destructive"
> = {
  low: "secondary",
  normal: "outline",
  high: "destructive",
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
    void resolveUri(envelope.from.uri).then((r) => {
      if (!cancelled) setIdentity(r);
    });
    return () => {
      cancelled = true;
    };
  }, [envelope.from.uri]);

  const signerLabel = signerCheck === "match" ? "✓ signature matches sender" : signerCheck === "mismatch" ? "⚠ signer does not match sender wallet" : signerCheck === "error" ? "⚠ signature could not be verified" : "verifying signature…";

  return (
    <article className="space-y-2">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-sm">{envelope.from.name || mailSenderShort(mail)}</span>
        {envelope.from.owner_url && (
          <a className="text-xs text-primary hover:underline" href={envelope.from.owner_url} target="_blank" rel="noreferrer noopener">
            {hostnameOf(envelope.from.owner_url)}
          </a>
        )}
        {identity && (
          <Badge variant="secondary" title={identity.description ?? identity.raw}>
            {identity.source === "erc8004" ? "erc-8004" : identity.source === "https" ? "https" : "uri"} ·{" "}
            {identity.display_name ?? identity.raw}
          </Badge>
        )}
        <Badge variant={URGENCY_VARIANT[envelope.urgency]}>{envelope.urgency}</Badge>
      </header>

      <h3 className="text-base font-medium leading-tight">{envelope.title}</h3>

      <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{envelope.body}</pre>

      {envelope.action_url && (
        <Button asChild size="sm">
          <a href={envelope.action_url} target="_blank" rel="noreferrer noopener">
            {hostnameOf(envelope.action_url)} →
          </a>
        </Button>
      )}

      <Separator />

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
        <span>sent {formatTimestamp(envelope.sent_at)}</span>
        <span title={mail.sender} className="font-mono">from {mailSenderShort(mail)}</span>
        <span>fee {mail.valueGwei} gwei</span>
        {envelope.reply_to && (
          <span title={envelope.reply_to} className="font-mono">in reply to {envelope.reply_to.slice(0, 10)}…</span>
        )}
        <span className={signerCheck === "match" ? "text-emerald-600" : signerCheck === "mismatch" || signerCheck === "error" ? "text-destructive" : ""}>{signerLabel}</span>
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
