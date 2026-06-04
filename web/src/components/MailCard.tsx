import { useState } from "react";
import type { DecodedPayload, MailEvent } from "@heed/core";
import { Badge, Button, Card, Code, Group, Stack, Text } from "@mantine/core";
import { useMailDecryption } from "../hooks/useMailDecryption";
import { useCompose } from "../lib/composeDraft";
import { errorMessage } from "../lib/format";
import { EnvelopeCard } from "./EnvelopeCard";

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
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" miw={0}>
            {read === false && (
              <span
                aria-label="Unread"
                title="Unread"
                style={{
                  flexShrink: 0,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: "var(--mantine-color-indigo-5)",
                }}
              />
            )}
            <Text size="sm" c="dimmed">
              {counterpartyLabel} <Code fz="xs">{counterparty}</Code>
            </Text>
          </Group>
          {direction === "received" && (
            <Button variant="subtle" size="compact-sm" onClick={reply}>
              Reply
            </Button>
          )}
        </Group>
        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color="gray">
            {direction === "sent" ? "paid" : "fee"} {mail.valueGwei} gwei
          </Badge>
          <Text size="xs" c="dimmed">
            ref <Code fz="xs">{mail.contentRef.slice(0, 10)}…</Code>
          </Text>
        </Group>

        {content ? (
          renderDecoded(content, mail)
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => open(false)}
            loading={busy}
            w="fit-content"
          >
            {busy ? "Decrypting…" : "Open"}
          </Button>
        )}

        {error && (
          <Stack gap="xs">
            <Text size="xs" c="red" style={{ wordBreak: "break-word" }}>
              {error}
            </Text>
            <Button
              variant="light"
              color="red"
              size="sm"
              onClick={() => open(true)}
              loading={busy}
              w="fit-content"
            >
              Re-sign and retry
            </Button>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function renderDecoded(content: DecodedPayload, mail: MailEvent) {
  if (content.kind === "envelope") {
    return <EnvelopeCard envelope={content.envelope} mail={mail} />;
  }
  if (content.kind === "mail") {
    return (
      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          legacy mail · {content.mail.subject}
        </Text>
        <Text
          component="pre"
          size="sm"
          style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}
        >
          {content.mail.body.text}
        </Text>
      </Stack>
    );
  }
  return (
    <Text size="xs" c="dimmed">
      unknown payload — {content.bytes.length} bytes
    </Text>
  );
}
