import { useState } from "react";
import { isAddress, type Address } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMyInbox } from "../hooks/useMyInbox";
import { useHeedActions } from "../hooks/useHeedActions";
import { errorMessage } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type Task = "key" | "fee" | "trust" | "untrust";

export function Account() {
  const { data: inbox, isLoading } = useMyInbox();
  const actions = useHeedActions();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Task | null>(null);
  const [fee, setFee] = useState("");
  const [trustAddr, setTrustAddr] = useState("");

  const currentKey = inbox?.keys[0];
  const hasKey = !!currentKey && currentKey.pub !== ZERO_BYTES32;
  const currentNonce = hasKey ? Number(currentKey!.keyNonce) : -1;
  const nextNonce = currentNonce + 1;

  async function run(task: Task, fn: () => Promise<unknown>) {
    setBusy(task);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["myInbox"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">
          <span className="dot" />
          Identity
        </span>
        <h1 className="mt-1.5 font-display text-3xl font-medium tracking-tight">
          Account
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Encryption key</CardTitle>
          <CardDescription>
            Publish an X25519 public key so others can send you encrypted mail.
            It is derived from a wallet signature; the private key never leaves
            this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="label-mono">Status</span>
            {isLoading ? (
              <Badge variant="secondary">loading…</Badge>
            ) : hasKey ? (
              <Badge className="bg-signal/15 text-signal">
                published (nonce {currentNonce})
              </Badge>
            ) : (
              <Badge variant="destructive">not published</Badge>
            )}
          </div>
          {hasKey && (
            <p className="rounded-md border border-border bg-muted/40 p-2.5 font-mono text-xs break-all text-muted-foreground">
              {currentKey!.pub}
            </p>
          )}
          <Button
            disabled={busy !== null}
            onClick={() =>
              run("key", async () => {
                await actions.publishKey(nextNonce);
                toast.success(`Encryption key published (nonce ${nextNonce}).`);
              })
            }
          >
            {busy === "key"
              ? "Publishing…"
              : hasKey
                ? "Rotate key"
                : "Publish key"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anti-spam fee</CardTitle>
          <CardDescription>
            Senders must pay this fee (in gwei) to mail you, unless you trust
            them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <span className="label-mono mr-2">Current</span>
            <span className="font-mono">
              {isLoading ? "…" : `${Number(inbox?.feeGwei ?? 0)} gwei`}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-fee" className="label-mono">
              New fee (gwei)
            </Label>
            <Input
              id="account-fee"
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0"
              className="font-mono"
            />
          </div>
          <Button
            variant="outline"
            disabled={busy !== null || fee === ""}
            onClick={() =>
              run("fee", async () => {
                const v = Number(fee);
                if (!Number.isInteger(v) || v < 0) {
                  throw new Error("fee must be a non-negative whole number");
                }
                await actions.setFee(v);
                toast.success(`Anti-spam fee set to ${v} gwei.`);
                setFee("");
              })
            }
          >
            {busy === "fee" ? "Saving…" : "Set fee"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trusted senders</CardTitle>
          <CardDescription>
            Trusted addresses can mail you for free, bypassing your fee.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="account-trust" className="label-mono">
              Address
            </Label>
            <Input
              id="account-trust"
              value={trustAddr}
              onChange={(e) => setTrustAddr(e.target.value.trim())}
              placeholder="0x…"
              className="font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy !== null || !isAddress(trustAddr)}
              onClick={() =>
                run("trust", async () => {
                  await actions.trust([trustAddr as Address]);
                  toast.success("Sender trusted.");
                  setTrustAddr("");
                })
              }
            >
              {busy === "trust" ? "Trusting…" : "Trust"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== null || !isAddress(trustAddr)}
              onClick={() =>
                run("untrust", async () => {
                  await actions.untrust([trustAddr as Address]);
                  toast.success("Sender untrusted.");
                  setTrustAddr("");
                })
              }
            >
              {busy === "untrust" ? "Removing…" : "Untrust"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
