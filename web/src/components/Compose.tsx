import { useEffect, useRef, useState } from "react";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { createReadClient } from "@heed/core";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  Anchor,
  Button,
  Card,
  Code,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSendMail, type SendStage } from "../hooks/useSendMail";
import { useCompose } from "../lib/composeDraft";
import { getEffectiveConfig } from "../lib/settings";
import {
  clearDraft as clearDbDraft,
  getDraft,
  saveDraft as saveDbDraft,
} from "../lib/db";
import { errorMessage } from "../lib/format";

const STAGE_LABEL: Record<SendStage, string> = {
  lookup: "Looking up recipients…",
  "derive-key": "Deriving sender key…",
  encrypt: "Encrypting…",
  pin: "Pinning to IPFS…",
  submit: "Submitting transaction…",
  confirm: "Waiting for confirmation…",
};

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

interface Parsed {
  valid: Address[];
  invalid: string[];
}

function parseAddresses(s: string): Parsed {
  const parts = s
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const valid: Address[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (isAddress(p)) valid.push(p);
    else invalid.push(p);
  }
  return { valid, invalid };
}

function dedupe(addrs: Address[]): Address[] {
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const a of addrs) {
    const k = a.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

export function Compose() {
  const send = useSendMail();
  const qc = useQueryClient();
  const { address, chainId } = useAccount();
  const cfg = getEffectiveConfig(chainId);
  const account = address?.toLowerCase();
  const { draft, clearDraft } = useCompose();

  const [to, setTo] = useState(draft?.to ?? "");
  const [cc, setCc] = useState(draft?.cc ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [inReplyTo, setInReplyTo] = useState<string | undefined>(
    draft?.inReplyTo,
  );

  const hadContextDraft = useRef(draft != null);
  const seeded = useRef(false);

  const [preview, setPreview] = useState<{
    encrypted: boolean;
    totalFeeGwei: number;
    recipientCount: number;
  } | null>(null);
  const [hint, setHint] = useState("");
  const [stage, setStage] = useState<SendStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    txHash: string;
    cid: string;
    encrypted: boolean;
  } | null>(null);

  useEffect(() => {
    clearDraft();
  }, [clearDraft]);

  useEffect(() => {
    if (seeded.current || hadContextDraft.current || !account) return;
    seeded.current = true;
    void getDraft(cfg.chainId, account).then((d) => {
      if (!d) return;
      setTo(d.to);
      setCc(d.cc);
      setSubject(d.subject);
      setBody(d.body);
      setInReplyTo(d.inReplyTo);
    });
  }, [account, cfg.chainId]);

  useEffect(() => {
    if (!account) return;
    const handle = setTimeout(() => {
      if (!to && !cc && !subject && !body) {
        void clearDbDraft(cfg.chainId, account).catch(() => {});
      } else {
        void saveDbDraft(cfg.chainId, account, {
          to,
          cc,
          subject,
          body,
          inReplyTo,
        }).catch(() => {});
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [account, cfg.chainId, to, cc, subject, body, inReplyTo]);

  async function refreshPreview(): Promise<boolean | null> {
    setHint("");
    setPreview(null);
    const t = parseAddresses(to);
    const c = parseAddresses(cc);
    if (t.invalid.length || c.invalid.length) {
      setHint(`Invalid address: ${[...t.invalid, ...c.invalid].join(", ")}`);
      return null;
    }
    const recipients = dedupe([...t.valid, ...c.valid]);
    if (recipients.length === 0) return null;
    try {
      const cfg = getEffectiveConfig(chainId);
      const reader = createReadClient(
        createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) }),
        cfg.contractAddress,
      );
      const inboxes = await reader.getInboxes(recipients);
      let total = 0;
      let allKeys = true;
      for (const ib of inboxes) {
        total += Number(ib.feeGwei);
        if (!ib.keys[0] || ib.keys[0].pub === ZERO_BYTES32) allKeys = false;
      }
      setPreview({
        encrypted: allKeys,
        totalFeeGwei: total,
        recipientCount: recipients.length,
      });
      setHint(
        allKeys
          ? `${recipients.length} recipient(s) · total fee ${total} gwei · encrypted`
          : `${recipients.length} recipient(s) · total fee ${total} gwei · some have no key — will send PLAINTEXT`,
      );
      return allKeys;
    } catch (e) {
      setHint(`Could not look up recipients: ${errorMessage(e)}`);
      return null;
    }
  }

  async function onSend() {
    const t = parseAddresses(to);
    const c = parseAddresses(cc);
    if (t.invalid.length || c.invalid.length) {
      setHint(`Invalid address: ${[...t.invalid, ...c.invalid].join(", ")}`);
      return;
    }
    if (t.valid.length === 0) {
      setHint("add at least one recipient in the To field");
      return;
    }
    if (!subject.trim() && !body.trim()) {
      notifications.show({
        color: "red",
        message: "subject or body must be non-empty",
      });
      return;
    }
    const encrypted = preview ? preview.encrypted : await refreshPreview();
    if (encrypted === false) {
      setConfirmOpen(true);
      return;
    }
    await doSend();
  }

  async function doSend() {
    setConfirmOpen(false);
    setResult(null);
    setBusy(true);
    setStage(null);
    try {
      const t = parseAddresses(to);
      const c = parseAddresses(cc);
      const r = await send({
        to: t.valid,
        cc: c.valid,
        subject,
        body,
        inReplyTo,
        onProgress: setStage,
      });
      setResult({ txHash: r.txHash, cid: r.cid, encrypted: r.encrypted });
      setSubject("");
      setBody("");
      setPreview(null);
      if (account) void clearDbDraft(cfg.chainId, account).catch(() => {});
      notifications.show({
        color: "teal",
        message: `Sent to ${r.recipients.length} recipient(s) ${r.encrypted ? "(encrypted)" : "(plaintext)"}.`,
      });
      await qc.invalidateQueries({ queryKey: ["outbox"] });
    } catch (e) {
      notifications.show({ color: "red", message: errorMessage(e) });
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <Card withBorder maw={720} padding="lg" radius="md">
      <Stack gap="md">
        <Title order={2}>Compose</Title>

        <TextInput
          id="compose-to"
          label="To (one or more addresses)"
          value={to}
          onChange={(e) => setTo(e.currentTarget.value)}
          onBlur={refreshPreview}
          placeholder="0x… , 0x…"
          styles={{
            input: { fontFamily: "var(--mantine-font-family-monospace)" },
          }}
        />

        <TextInput
          id="compose-cc"
          label="Cc (optional)"
          value={cc}
          onChange={(e) => setCc(e.currentTarget.value)}
          onBlur={refreshPreview}
          placeholder="0x… , 0x…"
          styles={{
            input: { fontFamily: "var(--mantine-font-family-monospace)" },
          }}
        />

        {hint && (
          <Text
            size="xs"
            c={preview && !preview.encrypted ? "yellow" : "dimmed"}
          >
            {hint}
          </Text>
        )}

        <TextInput
          id="compose-subject"
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
        />

        <Textarea
          id="compose-body"
          label="Body"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          rows={8}
          autosize
          minRows={8}
        />

        <Group gap="md" align="center">
          <Button onClick={onSend} loading={busy} disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </Button>
          {stage && (
            <Text size="sm" c="dimmed">
              {STAGE_LABEL[stage]}
            </Text>
          )}
        </Group>

        {result && (
          <Stack gap={4}>
            <Text size="sm" style={{ wordBreak: "break-all" }}>
              tx: <Code fz="xs">{result.txHash}</Code>
            </Text>
            <Text size="sm" style={{ wordBreak: "break-all" }}>
              cid: <Code fz="xs">{result.cid}</Code>
            </Text>
            <Anchor
              size="xs"
              href={`${cfg.explorer}/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on {cfg.label} explorer ↗
            </Anchor>
          </Stack>
        )}
      </Stack>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Send as plaintext?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            One or more recipients have not published an encryption key. This
            message will be stored unencrypted on IPFS and anyone can read it.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={doSend}>
              Send plaintext
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
