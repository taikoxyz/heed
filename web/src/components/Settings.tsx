import { useState } from "react";
import {
  EMPTY_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings as SettingsT,
} from "../lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function isHttpUrl(s: string): boolean {
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function Settings() {
  const [draft, setDraft] = useState<SettingsT>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SettingsT>(key: K, value: SettingsT[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
    setError(null);
  }

  function onSave() {
    const bad = (
      [
        ["RPC URL", draft.rpcUrl],
        ["IPFS gateway", draft.ipfsGateway],
        ["Indexer URL", draft.indexerUrl],
      ] as const
    ).find(([, v]) => !isHttpUrl(v));
    if (bad) {
      setSaved(false);
      setError(`${bad[0]} must be a valid http(s) URL.`);
      return;
    }
    setError(null);
    saveSettings(draft);
    setSaved(true);
  }

  function onReset() {
    setDraft(EMPTY_SETTINGS);
    saveSettings(EMPTY_SETTINGS);
    setError(null);
    setSaved(true);
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">Settings</CardTitle>
        <CardDescription>
          Empty fields fall back to the build-time defaults. Saved to
          localStorage on this device only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="settings-rpc">RPC URL</Label>
          <Input
            id="settings-rpc"
            type="text"
            value={draft.rpcUrl}
            onChange={(e) => update("rpcUrl", e.target.value)}
            placeholder="https://rpc.mainnet.taiko.xyz"
            className="font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="settings-ipfs">IPFS gateway</Label>
          <Input
            id="settings-ipfs"
            type="text"
            value={draft.ipfsGateway}
            onChange={(e) => update("ipfsGateway", e.target.value)}
            placeholder="https://gateway.pinata.cloud"
            className="font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="settings-indexer">Indexer URL</Label>
          <Input
            id="settings-indexer"
            type="text"
            value={draft.indexerUrl}
            onChange={(e) => update("indexerUrl", e.target.value)}
            placeholder="(unset → falls back to RPC log scan)"
            className="font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="settings-fee">Max anti-spam fee (gwei)</Label>
          <Input
            id="settings-fee"
            type="number"
            min={0}
            value={draft.maxFeeGwei || ""}
            onChange={(e) => update("maxFeeGwei", Number(e.target.value) || 0)}
            placeholder="0"
            className="font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="settings-pinata">Pinata JWT</Label>
          <Input
            id="settings-pinata"
            type="password"
            value={draft.pinataJwt}
            onChange={(e) => update("pinataJwt", e.target.value)}
            placeholder="(required to send mail)"
            className="font-mono"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Used to pin encrypted mail to IPFS. Generate a scoped
            "pinFileToIPFS / pinJSONToIPFS" key at pinata.cloud. Stored only in
            this browser's localStorage.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={onSave}>Save</Button>
          <Button variant="outline" onClick={onReset}>
            Reset
          </Button>
          {saved && <span className="text-sm text-emerald-600">Saved.</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
