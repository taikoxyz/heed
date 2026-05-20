import { useEffect, useState } from "react";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { taiko } from "viem/chains";
import { createReadClient } from "@heed/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSendMail, type SendStage } from "../hooks/useSendMail";
import { useCompose } from "../lib/composeDraft";
import { getEffectiveConfig } from "../lib/settings";
import { errorMessage } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { draft, clearDraft } = useCompose();

  const [to, setTo] = useState(draft?.to ?? "");
  const [cc, setCc] = useState(draft?.cc ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [inReplyTo] = useState<string | undefined>(draft?.inReplyTo);

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

  // Consume the one-shot draft so a later manual visit starts blank.
  useEffect(() => {
    clearDraft();
  }, [clearDraft]);

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
      const cfg = getEffectiveConfig();
      const reader = createReadClient(
        createPublicClient({ chain: taiko, transport: http(cfg.rpcUrl) }),
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
      toast.error("subject or body must be non-empty");
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
      toast.success(
        `Sent to ${r.recipients.length} recipient(s) ${r.encrypted ? "(encrypted)" : "(plaintext)"}.`,
      );
      await qc.invalidateQueries({ queryKey: ["outbox"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">Compose</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="compose-to">To (one or more addresses)</Label>
          <Input
            id="compose-to"
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onBlur={refreshPreview}
            placeholder="0x… , 0x…"
            className="font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="compose-cc">Cc (optional)</Label>
          <Input
            id="compose-cc"
            type="text"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            onBlur={refreshPreview}
            placeholder="0x… , 0x…"
            className="font-mono"
          />
        </div>

        {hint && (
          <p
            className={`text-xs ${
              preview && !preview.encrypted
                ? "text-amber-600"
                : "text-muted-foreground"
            }`}
          >
            {hint}
          </p>
        )}

        <div className="space-y-1">
          <Label htmlFor="compose-subject">Subject</Label>
          <Input
            id="compose-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="compose-body">Body</Label>
          <Textarea
            id="compose-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={onSend} disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </Button>
          {stage && (
            <span className="text-sm text-muted-foreground">
              {STAGE_LABEL[stage]}
            </span>
          )}
        </div>

        {result && (
          <div className="space-y-1 text-sm">
            <div className="break-all">
              tx: <code className="text-xs">{result.txHash}</code>
            </div>
            <div className="break-all">
              cid: <code className="text-xs">{result.cid}</code>
            </div>
            <a
              className="text-xs text-primary underline"
              href={`https://taikoscan.io/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Taikoscan ↗
            </a>
          </div>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send as plaintext?</DialogTitle>
            <DialogDescription>
              One or more recipients have not published an encryption key. This
              message will be stored unencrypted on IPFS and anyone can read it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doSend}>
              Send plaintext
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
