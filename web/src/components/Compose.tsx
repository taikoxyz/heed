import { useEffect, useRef, useState } from "react";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { createReadClient } from "@heed/core";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { SendIcon } from "lucide-react";
import { useSendMail, type SendStage } from "../hooks/useSendMail";
import { useCompose } from "../lib/composeDraft";
import { getEffectiveConfig } from "../lib/settings";
import {
  clearDraft as clearDbDraft,
  getDraft,
  saveDraft as saveDbDraft,
} from "../lib/db";
import { errorMessage } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      if (account) void clearDbDraft(cfg.chainId, account).catch(() => {});
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

  const monoInput = "font-mono text-sm";

  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">
          <span className="dot" />
          New message
        </span>
        <h1 className="mt-1.5 font-display text-3xl font-medium tracking-tight">
          Compose
        </h1>
      </div>

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>Compose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="compose-to" className="label-mono">
              To (one or more addresses)
            </Label>
            <Input
              id="compose-to"
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onBlur={refreshPreview}
              placeholder="0x… , 0x…"
              className={monoInput}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-cc" className="label-mono">
              Cc (optional)
            </Label>
            <Input
              id="compose-cc"
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              onBlur={refreshPreview}
              placeholder="0x… , 0x…"
              className={monoInput}
            />
          </div>

          {hint && (
            <p
              className={`font-mono text-xs ${
                preview && !preview.encrypted
                  ? "text-amber-500"
                  : "text-muted-foreground"
              }`}
            >
              {hint}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="compose-subject" className="label-mono">
              Subject
            </Label>
            <Input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-body" className="label-mono">
              Body
            </Label>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={onSend} disabled={busy} className="gap-1.5">
              <SendIcon className="size-4" />
              {busy ? "Sending…" : "Send"}
            </Button>
            {stage && (
              <span className="font-mono text-xs text-muted-foreground">
                {STAGE_LABEL[stage]}
              </span>
            )}
          </div>

          {result && (
            <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs">
              <div className="break-all">
                <span className="text-muted-foreground">tx </span>
                {result.txHash}
              </div>
              <div className="break-all">
                <span className="text-muted-foreground">cid </span>
                {result.cid}
              </div>
              <a
                className="text-signal underline-offset-2 hover:underline"
                href={`${cfg.explorer}/tx/${result.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View on {cfg.label} explorer ↗
              </a>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
