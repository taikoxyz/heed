import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import {
  clearSettings,
  emptyNetwork,
  loadSettings,
  saveSettings,
  type NetworkSettings,
  type Settings as SettingsT,
} from "../lib/settings";
import {
  NETWORKS,
  parseGateways,
  PUBLIC_RPC,
  SUPPORTED_CHAINS,
} from "../lib/config";
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
import { Separator } from "@/components/ui/separator";
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
  const [showJwt, setShowJwt] = useState(false);

  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [importData, setImportData] = useState<HeedExport | null>(null);

  const gwError = gatewayError(draft.ipfsGateway);

  function updateNetwork<K extends keyof NetworkSettings>(
    chainId: number,
    key: K,
    value: NetworkSettings[K],
  ) {
    setDraft((d) => ({
      ...d,
      networks: {
        ...d.networks,
        [chainId]: { ...(d.networks[chainId] ?? emptyNetwork()), [key]: value },
      },
    }));
    setSaved(false);
  }

  function updateGlobal<K extends "ipfsGateway" | "pinataJwt">(
    key: K,
    value: SettingsT[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function onSave() {
    if (gwError) return;
    saveSettings(draft);
    setSaved(true);
  }

  function onReset() {
    const empty: SettingsT = {
      networks: Object.fromEntries(
        SUPPORTED_CHAINS.map((c) => [c.id, emptyNetwork()]),
      ),
      ipfsGateway: "",
      pinataJwt: "",
    };
    setDraft(empty);
    saveSettings(empty);
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
    setDraft(loadSettings());
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
      setDraft(loadSettings());
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
    <div className="space-y-5">
      <div>
        <span className="eyebrow">
          <span className="dot" />
          Configuration
        </span>
        <h1 className="mt-1.5 font-display text-3xl font-medium tracking-tight">
          Settings
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Networks</CardTitle>
          <CardDescription>
            Per-network RPC, indexer and anti-spam limits. Empty fields fall
            back to a public node, so Heed still works without any
            configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SUPPORTED_CHAINS.map((chain, i) => {
            const net = NETWORKS[chain.id]!;
            const entry = draft.networks[chain.id] ?? emptyNetwork();
            const usingPublicRpc = entry.rpcUrl.trim() === "";
            return (
              <div key={chain.id} className="space-y-3">
                {i > 0 && <Separator />}
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display text-lg font-medium">
                    {net.label}
                  </h3>
                  <span className="label-mono">chainId {chain.id}</span>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor={`settings-rpc-${chain.id}`}
                    className="label-mono"
                  >
                    {net.label} RPC URL
                  </Label>
                  <Input
                    id={`settings-rpc-${chain.id}`}
                    type="text"
                    value={entry.rpcUrl}
                    onChange={(e) =>
                      updateNetwork(chain.id, "rpcUrl", e.target.value)
                    }
                    placeholder={PUBLIC_RPC[chain.id]!}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {usingPublicRpc ? (
                      <>
                        Using public node{" "}
                        <code className="text-foreground/70">{net.rpcUrl}</code>
                        . Public endpoints rate-limit aggressively — set your
                        own for reliable inbox/send.
                      </>
                    ) : (
                      "Custom RPC — used for inbox scans, sends, and key actions on this network."
                    )}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor={`settings-indexer-${chain.id}`}
                    className="label-mono"
                  >
                    {net.label} indexer URL
                  </Label>
                  <Input
                    id={`settings-indexer-${chain.id}`}
                    type="text"
                    value={entry.indexerUrl}
                    onChange={(e) =>
                      updateNetwork(chain.id, "indexerUrl", e.target.value)
                    }
                    placeholder="(unset → falls back to RPC log scan)"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    A GraphQL indexer speeds up inbox loading. When empty, Heed
                    scans logs over RPC instead (slower but always works).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor={`settings-fee-${chain.id}`}
                    className="label-mono"
                  >
                    Max anti-spam fee on {net.label} (gwei)
                  </Label>
                  <Input
                    id={`settings-fee-${chain.id}`}
                    type="number"
                    min={0}
                    value={entry.maxFeeGwei || ""}
                    onChange={(e) =>
                      updateNetwork(
                        chain.id,
                        "maxFeeGwei",
                        Number(e.target.value) || 0,
                      )
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Send will refuse recipients charging more than this. 0 means
                    no cap.
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IPFS &amp; pinning</CardTitle>
          <CardDescription>
            Chain-independent. IPFS is content-addressed, so the same gateway
            and pinning service work for every network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="settings-ipfs" className="label-mono">
              IPFS gateway(s)
            </Label>
            <Input
              id="settings-ipfs"
              type="text"
              value={draft.ipfsGateway}
              onChange={(e) => updateGlobal("ipfsGateway", e.target.value)}
              placeholder="https://gateway.pinata.cloud,https://ipfs.io"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list, tried in order with fallback on failure.
            </p>
            {gwError && <p className="text-xs text-destructive">{gwError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-pinata" className="label-mono">
              Pinata JWT
            </Label>
            <div className="relative">
              <Input
                id="settings-pinata"
                type={showJwt ? "text" : "password"}
                value={draft.pinataJwt}
                onChange={(e) => updateGlobal("pinataJwt", e.target.value)}
                placeholder="(required to send mail)"
                className="pr-9 font-mono text-sm"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowJwt((s) => !s)}
                aria-label={showJwt ? "Hide JWT" : "Show JWT"}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showJwt ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
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
                  className="underline underline-offset-2"
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
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={!!gwError}>
          Save
        </Button>
        <Button variant="outline" onClick={onReset}>
          Reset
        </Button>
        <Button variant="ghost" onClick={onClearAll}>
          Clear all settings
        </Button>
        {saved && <span className="font-mono text-xs text-signal">Saved</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backup &amp; restore</CardTitle>
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
