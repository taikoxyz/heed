import { useState } from "react";
import { LockIcon } from "lucide-react";
import type { DecodedPayload, MailEvent } from "@heed/core";
import { useMailDecryption } from "../hooks/useMailDecryption";
import { useNow } from "../hooks/useNow";
import { useCompose } from "../lib/composeDraft";
import { errorMessage, formatRelativeTime } from "../lib/format";
import { EnvelopeCard } from "./EnvelopeCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function MailCard({
  mail,
  direction = "received",
  read,
  onOpened,
}: {
  mail: MailEvent;
  direction?: "received" | "sent";
  read?: boolean;
  onOpened?: (txHash: string) => void;
}) {
  const [content, setContent] = useState<DecodedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decrypt = useMailDecryption();
  const { openCompose } = useCompose();
  const now = useNow();

  async function open(force = false) {
    setError(null);
    setBusy(true);
    try {
      setContent(await decrypt(mail.contentRef, { force }));
      onOpened?.(mail.txHash);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function reply() {
    let subject = "";
    let inReplyTo: string | undefined;
    if (content?.kind === "mail") {
      subject = content.mail.subject ? `Re: ${content.mail.subject}` : "";
      inReplyTo = content.mail.msgId;
    } else if (content?.kind === "envelope") {
      subject = content.envelope.title ? `Re: ${content.envelope.title}` : "";
    }
    openCompose({ to: mail.sender, subject, inReplyTo });
  }

  const counterparty = direction === "sent" ? mail.recipient : mail.sender;
  const counterpartyLabel = direction === "sent" ? "to" : "from";

  return (
    <Card
      size="sm"
      className="transition-colors hover:ring-foreground/20 data-[unread=true]:ring-signal/40"
      data-unread={read === false ? "true" : undefined}
    >
      <CardContent className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            {read === false && (
              <span
                className="size-2 shrink-0 rounded-full bg-signal shadow-[0_0_0_3px_color-mix(in_srgb,var(--signal)_22%,transparent)]"
                aria-label="Unread"
                title="Unread"
              />
            )}
            <span className="truncate">
              <span className="label-mono mr-1.5">{counterpartyLabel}</span>
              <span className="font-mono text-foreground/90">
                {counterparty}
              </span>
            </span>
          </div>
          {direction === "received" && (
            <Button variant="ghost" size="xs" onClick={reply}>
              Reply
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-mono font-normal">
            {direction === "sent" ? "paid" : "fee"} {mail.valueGwei} gwei
          </Badge>
          <span className="font-mono">
            ref{" "}
            <code className="text-foreground/70">
              {mail.contentRef.slice(0, 10)}…
            </code>
          </span>
          <span
            className="font-mono"
            title={new Date(
              Number(mail.blockTimestamp) * 1000,
            ).toLocaleString()}
          >
            {formatRelativeTime(mail.blockTimestamp, now)}
          </span>
        </div>

        {content ? (
          <div className="pt-1">{renderDecoded(content, mail)}</div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => open(false)}
            disabled={busy}
            className="gap-1.5"
          >
            <LockIcon className="size-3.5" />
            {busy ? "Decrypting…" : "Open"}
          </Button>
        )}

        {error && (
          <div className="space-y-1.5 text-xs text-destructive">
            <div className="break-words">{error}</div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => open(true)}
              disabled={busy}
            >
              Re-sign and retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function renderDecoded(content: DecodedPayload, mail: MailEvent) {
  if (content.kind === "envelope") {
    return <EnvelopeCard envelope={content.envelope} mail={mail} />;
  }
  if (content.kind === "mail") {
    return (
      <div className="space-y-1">
        <div className="label-mono">legacy mail · {content.mail.subject}</div>
        <pre className="font-sans text-sm whitespace-pre-wrap text-foreground">
          {content.mail.body.text}
        </pre>
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground">
      unknown payload — {content.bytes.length} bytes
    </div>
  );
}
