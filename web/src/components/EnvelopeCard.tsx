import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  recoverEnvelopeSigner,
  type Envelope,
  type MailEvent,
} from "@heed/core";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { type ResolvedIdentity } from "../lib/uri";
import { resolveIdentity } from "../lib/identity";
import { getEffectiveConfig } from "../lib/settings";

const URGENCY_COLOR: Record<Envelope["urgency"], string> = {
  low: "gray",
  normal: "blue",
  high: "red",
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
      ? "✓ signature matches sender"
      : signerCheck === "mismatch"
        ? "⚠ signer does not match sender wallet"
        : signerCheck === "error"
          ? "⚠ signature could not be verified"
          : "verifying signature…";

  const signerColor =
    signerCheck === "match"
      ? "teal"
      : signerCheck === "mismatch" || signerCheck === "error"
        ? "red"
        : "dimmed";

  return (
    <Stack gap="sm" component="article">
      <Group gap="xs" wrap="wrap">
        <Text fw={600} size="sm">
          {envelope.from.name || mailSenderShort(mail)}
        </Text>
        {envelope.from.owner_url && (
          <Anchor
            href={envelope.from.owner_url}
            target="_blank"
            rel="noreferrer noopener"
            size="xs"
          >
            {hostnameOf(envelope.from.owner_url)}
          </Anchor>
        )}
        {identity && (
          <Badge
            variant={identity.verified ? "light" : "outline"}
            color={identity.verified ? "teal" : "gray"}
            title={identity.description ?? identity.raw}
          >
            {identity.verified ? "✓ " : "○ "}
            {identity.source === "erc8004"
              ? "erc-8004"
              : identity.source === "https"
                ? "https"
                : "uri"}{" "}
            · {identity.display_name ?? identity.raw}
          </Badge>
        )}
        <Badge variant="light" color={URGENCY_COLOR[envelope.urgency]}>
          {envelope.urgency}
        </Badge>
      </Group>

      <Title order={3} size="h3" mt="xs" mb="xs">
        {envelope.title}
      </Title>

      <Text
        component="pre"
        size="sm"
        style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}
      >
        {envelope.body}
      </Text>

      {envelope.action_url && (
        <Box>
          <Button
            component="a"
            href={envelope.action_url}
            target="_blank"
            rel="noreferrer noopener"
            size="sm"
            variant="default"
          >
            {hostnameOf(envelope.action_url)} →
          </Button>
        </Box>
      )}

      <Divider my="xs" />

      <Group component="footer" gap="md" wrap="wrap">
        <Text size="xs" c="dimmed">
          sent {formatTimestamp(envelope.sent_at)}
        </Text>
        <Text size="xs" c="dimmed" title={mail.sender}>
          from <Code fz="xs">{mailSenderShort(mail)}</Code>
        </Text>
        <Text size="xs" c="dimmed">
          fee {mail.valueGwei} gwei
        </Text>
        {envelope.reply_to && (
          <Text size="xs" c="dimmed" title={envelope.reply_to}>
            in reply to <Code fz="xs">{envelope.reply_to.slice(0, 10)}…</Code>
          </Text>
        )}
        <Text size="xs" c={signerColor}>
          {signerLabel}
        </Text>
      </Group>
    </Stack>
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
