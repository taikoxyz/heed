import { useState } from "react";
import { isAddress, type Address } from "viem";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createReadClient } from "@heed/core";
import { toast } from "sonner";
import { useSendMail, type SendStage } from "../hooks/useSendMail";
import { getEffectiveConfig } from "../lib/settings";
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

const STAGE_LABEL: Record<SendStage, string> = {
  lookup: "Looking up recipient…",
  "derive-key": "Deriving sender key…",
  encrypt: "Encrypting…",
  pin: "Pinning to IPFS…",
  submit: "Submitting transaction…",
  confirm: "Waiting for confirmation…",
};

export function Compose() {
  const send = useSendMail();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [feeGwei, setFeeGwei] = useState<number>(0);
  const [feeHint, setFeeHint] = useState<string>("");
  const [plaintextMode, setPlaintextMode] = useState(false);
  const [stage, setStage] = useState<SendStage | null>(null);
  const [result, setResult] = useState<{
    txHash: string;
    cid: string;
    encrypted: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onToBlur() {
    setFeeHint("");
    setPlaintextMode(false);
    if (!isAddress(to)) return;
    try {
      const cfg = getEffectiveConfig();
      const client = createPublicClient({
        chain: taiko,
        transport: http(cfg.rpcUrl),
      });
      const reader = createReadClient(client, cfg.contractAddress);
      const inbox = await reader.getInbox(to as Address);
      setFeeGwei(Number(inbox.feeGwei));
      const hasKey =
        inbox.keys[0] &&
        inbox.keys[0].pub !==
          "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (hasKey) {
        setFeeHint(`Recipient charges ${inbox.feeGwei} gwei.`);
        setPlaintextMode(false);
      } else {
        setFeeHint(
          `Recipient charges ${inbox.feeGwei} gwei. No published encryption key — message will be sent as PLAINTEXT (anyone can read).`,
        );
        setPlaintextMode(true);
      }
    } catch (e) {
      setFeeHint(
        `Could not fetch recipient fee: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function onSend() {
    setResult(null);
    setBusy(true);
    setStage(null);
    try {
      if (!isAddress(to)) throw new Error("recipient is not a valid address");
      if (!subject.trim() && !body.trim()) {
        throw new Error("subject or body must be non-empty");
      }
      const r = await send({
        recipient: to as Address,
        subject,
        body,
        feeGwei,
        onProgress: setStage,
      });
      setResult({ txHash: r.txHash, cid: r.cid, encrypted: r.encrypted });
      setSubject("");
      setBody("");
      toast.success(`Sent ${r.encrypted ? "(encrypted)" : "(plaintext)"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
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
          <Label htmlFor="compose-to">To (address)</Label>
          <Input
            id="compose-to"
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            onBlur={onToBlur}
            placeholder="0x…"
            className="font-mono"
          />
          {feeHint && (
            <p
              className={`text-xs ${
                plaintextMode ? "text-amber-600" : "text-muted-foreground"
              }`}
            >
              {feeHint}
            </p>
          )}
        </div>

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

        <div className="space-y-1">
          <Label htmlFor="compose-fee">Fee (gwei)</Label>
          <Input
            id="compose-fee"
            type="number"
            min={0}
            value={feeGwei || ""}
            onChange={(e) => setFeeGwei(Number(e.target.value) || 0)}
            className="font-mono"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={onSend} disabled={busy}>
            {busy ? "Sending…" : plaintextMode ? "Send (plaintext)" : "Send"}
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
    </Card>
  );
}
