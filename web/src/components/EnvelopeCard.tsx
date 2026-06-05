import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  BadgeCheckIcon,
  CheckIcon,
  ShieldAlertIcon,
  ExternalLinkIcon,
} from "lucide-react";
import {
  recoverEnvelopeSigner,
  type Envelope,
  type MailEvent,
} from "@heed/core";
import { type ResolvedIdentity } from "../lib/uri";
import { resolveIdentity } from "../lib/identity";
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

export function EnvelopeCard({
  envelope,
  mail,
}: {
  envelope: Envelope;
  mail: MailEvent;
}) {
  const { chainId } = useAccount();
  const [identity, setIdentity] = useState<ResolvedIdentity | null>(null);
  const [signerCheck, setSignerCheck] = useState<
    "pending" | "match" | "mismatch" | "error"
  >("pending");

  useEffect(() => {
    let cancelled = false;
    const cfg = getEffectiveConfig(chainId);
    void (async () => {
      try {
        const recovered = await recoverEnvelopeSigner({
          envelope,
          chainId: cfg.chainId,
          verifyingContract: cfg.contractAddress,
        });
        if (!cancelled) {
          setSignerCheck(
            recovered.toLowerCase() === mail.sender.toLowerCase()
              ? "match"
              : "mismatch",
          );
        }
      } catch {
        if (!cancelled) setSignerCheck("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelope, mail.sender, chainId]);

  useEffect(() => {
    if (!envelope.from.uri) {
      setIdentity(null);
      return;
    }
    let cancelled = false;
    const cfg = getEffectiveConfig(chainId);
    void resolveIdentity(envelope.from.uri, cfg.rpcUrl, cfg.chain).then((r) => {
      if (!cancelled) setIdentity(r);
    });
    return () => {
      cancelled = true;
    };
  }, [envelope.from.uri, chainId]);

  const signerLabel =
    signerCheck === "match"
      ? "signature matches sender"
      : signerCheck === "mismatch"
        ? "signer does not match sender wallet"
        : signerCheck === "error"
          ? "signature could not be verified"
          : "verifying signature…";

  return (
    <article className="space-y-2.5">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-base font-semibold">
          {envelope.from.name || mailSenderShort(mail)}
        </span>
        {envelope.from.owner_url && (
          <a
            className="text-xs text-signal hover:underline"
            href={envelope.from.owner_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {hostnameOf(envelope.from.owner_url)}
          </a>
        )}
        {identity && (
          <Badge
            variant={identity.verified ? "secondary" : "outline"}
            title={identity.description ?? identity.raw}
            className="gap-1 font-mono font-normal"
          >
            {identity.verified ? <BadgeCheckIcon className="size-3" /> : null}
            {identity.source === "erc8004"
              ? "erc-8004"
              : identity.source === "https"
                ? "https"
                : "uri"}{" "}
            · {identity.display_name ?? identity.raw}
          </Badge>
        )}
        <Badge variant={URGENCY_VARIANT[envelope.urgency]}>
          {envelope.urgency}
        </Badge>
      </header>

      <h3 className="font-display text-2xl leading-tight font-medium tracking-tight">
        {envelope.title}
      </h3>

      <pre className="font-sans text-[0.95rem] leading-relaxed whitespace-pre-wrap text-foreground">
        {envelope.body}
      </pre>

      {envelope.action_url && (
        <Button asChild size="sm" className="gap-1.5">
          <a
            href={envelope.action_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {hostnameOf(envelope.action_url)}
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </Button>
      )}

      <Separator className="my-1" />

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 font-mono text-xs text-muted-foreground">
        <span>sent {formatTimestamp(envelope.sent_at)}</span>
        <span title={mail.sender}>from {mailSenderShort(mail)}</span>
        <span>fee {mail.valueGwei} gwei</span>
        {envelope.reply_to && (
          <span title={envelope.reply_to}>
            in reply to {envelope.reply_to.slice(0, 10)}…
          </span>
        )}
        <span
          className={
            "inline-flex items-center gap-1 " +
            (signerCheck === "match"
              ? "text-emerald-500"
              : signerCheck === "mismatch" || signerCheck === "error"
                ? "text-destructive"
                : "")
          }
        >
          {signerCheck === "match" ? (
            <CheckIcon className="size-3" />
          ) : signerCheck === "mismatch" || signerCheck === "error" ? (
            <ShieldAlertIcon className="size-3" />
          ) : null}
          {signerLabel}
        </span>
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
