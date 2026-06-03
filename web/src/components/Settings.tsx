import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clearSettings,
  EMPTY_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings as SettingsT,
} from "../lib/settings";
import { parseGateways } from "../lib/config";
import {
  clearAll,
  exportAll,
  importAll,
  parseImportFile,
  serializeExportZip,
  downloadBlob,
  type HeedExport,
} from "../lib/db";
import { errorMessage } from "../lib/format";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function gatewayError(value: string): string | null {
  if (!value.trim()) return null;
  for (const g of parseGateways(value)) {
    try {
      const u = new URL(g);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return `Not an http(s) URL: ${g}`;
      }
    } catch {
      return `Invalid URL: ${g}`;
    }
  }
  return null;
}

export function Settings() {
  const [draft, setDraft] = useState<SettingsT>(loadSettings);
  const [saved, setSaved] = useState(false);

  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [importData, setImportData] = useState<HeedExport | null>(null);

  const gwError = gatewayError(draft.ipfsGateway);

  function update<K extends keyof SettingsT>(key: K, value: SettingsT[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function onSave() {
    if (gwError) return;
    saveSettings(draft);
    setSaved(true);
  }

  function onReset() {
    setDraft(EMPTY_SETTINGS);
    saveSettings(EMPTY_SETTINGS);
    setSaved(true);
  }

  function onClearJwt() {
    const next = { ...draft, pinataJwt: "" };
    setDraft(next);
    saveSettings(next);
    setSaved(true);
  }

  function onClearAll() {
    clearSettings();
    setDraft(EMPTY_SETTINGS);
    setSaved(true);
  }

  async function onExport() {
    try {
      const data = await exportAll();
      const stamp = new Date().toISOString().slice(0, 10);
      const bytes = serializeExportZip(data.stores, data.settings);
      downloadBlob(
        new Blob([bytes], { type: "application/zip" }),
        `heed-export-${stamp}.zip`,
      );
      setExportOpen(false);
      toast.success("Backup downloaded.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImportData(await parseImportFile(file));
      setImportOpen(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function onImport(mode: "merge" | "replace") {
    if (!importData) return;
    try {
      await importAll(importData, mode);
      setDraft(importData.settings);
      await qc.invalidateQueries();
      setImportOpen(false);
      setImportData(null);
      toast.success("Backup restored.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function onResetStore() {
    try {
      await clearAll();
      await qc.invalidateQueries();
      setResetOpen(false);
      toast.success("Local store cleared.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
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
            <Label htmlFor="settings-ipfs">IPFS gateway(s)</Label>
            <Input
              id="settings-ipfs"
              type="text"
              value={draft.ipfsGateway}
              onChange={(e) => update("ipfsGateway", e.target.value)}
              placeholder="https://gateway.pinata.cloud,https://ipfs.io"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list, tried in order with fallback on failure.
            </p>
            {gwError && <p className="text-xs text-destructive">{gwError}</p>}
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
              onChange={(e) =>
                update("maxFeeGwei", Number(e.target.value) || 0)
              }
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
              "pinFileToIPFS / pinJSONToIPFS" key at pinata.cloud. Stored only
              in this browser's localStorage.
            </p>
            {draft.pinataJwt && (
              <p className="text-xs text-destructive">
                Warning: the JWT is stored UNENCRYPTED in this browser's
                localStorage, readable by any script on this origin (e.g. via
                XSS). Use a scoped key and clear it when done. See{" "}
                <a
                  href="https://github.com/dantaik/heed/blob/main/SECURITY.md"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  SECURITY.md
                </a>
                .
              </p>
            )}
            {draft.pinataJwt && (
              <Button variant="outline" size="sm" onClick={onClearJwt}>
                Clear JWT
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={onSave} disabled={!!gwError}>
              Save
            </Button>
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
            <Button variant="ghost" onClick={onClearAll}>
              Clear all settings
            </Button>
            {saved && <span className="text-sm text-emerald-600">Saved.</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Backup &amp; restore</CardTitle>
          <CardDescription>
            Export all locally cached mail, read state, drafts and settings to a
            zip file, or restore from one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              Export data
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Import data
            </Button>
            <Button variant="ghost" onClick={() => setResetOpen(true)}>
              Reset local store
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              className="hidden"
              aria-label="Import backup file"
              onChange={onFile}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The backup contains decrypted message content in plaintext. Keep the
            file somewhere safe.
          </p>
        </CardContent>
      </Card>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export your data?</DialogTitle>
            <DialogDescription>
              This downloads a zip file with your settings, cached mail, drafts
              and read state — including decrypted message content in plaintext.
              Anyone with the file can read your mail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onExport}>Download backup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore from backup?</DialogTitle>
            <DialogDescription>
              Merge keeps your current data and adds the backup's. Replace wipes
              local data first, then restores the backup exactly.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => onImport("replace")}>
              Replace
            </Button>
            <Button onClick={() => onImport("merge")}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset local store?</DialogTitle>
            <DialogDescription>
              This deletes cached mail, decoded content, drafts and read state
              on this device. Settings are kept, and on-chain mail will be
              re-fetched from RPC/IPFS on next load.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onResetStore}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
