import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
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
      notifications.show({ color: "teal", message: "Backup downloaded." });
    } catch (e) {
      notifications.show({ color: "red", message: errorMessage(e) });
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
      notifications.show({ color: "red", message: errorMessage(err) });
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
      notifications.show({ color: "teal", message: "Backup restored." });
    } catch (e) {
      notifications.show({ color: "red", message: errorMessage(e) });
    }
  }

  async function onResetStore() {
    try {
      await clearAll();
      await qc.invalidateQueries();
      setResetOpen(false);
      notifications.show({ color: "teal", message: "Local store cleared." });
    } catch (e) {
      notifications.show({ color: "red", message: errorMessage(e) });
    }
  }

  const monoInputStyles = {
    input: { fontFamily: "var(--mantine-font-family-monospace)" },
  };

  return (
    <Stack gap="md" maw={620}>
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Settings</Title>
            <Text size="sm" c="dimmed">
              Empty fields fall back to the build-time defaults. Saved to
              localStorage on this device only.
            </Text>
          </Stack>

          <TextInput
            id="settings-rpc"
            label="Taiko RPC URL"
            value={draft.rpcUrl}
            onChange={(e) => update("rpcUrl", e.currentTarget.value)}
            placeholder="https://rpc.mainnet.taiko.xyz"
            styles={monoInputStyles}
          />

          <TextInput
            id="settings-ipfs"
            label="IPFS gateway(s)"
            value={draft.ipfsGateway}
            onChange={(e) => update("ipfsGateway", e.currentTarget.value)}
            placeholder="https://gateway.pinata.cloud,https://ipfs.io"
            description="Comma-separated list, tried in order with fallback on failure."
            error={gwError ?? undefined}
            styles={monoInputStyles}
          />

          <TextInput
            id="settings-indexer"
            label="Indexer URL"
            value={draft.indexerUrl}
            onChange={(e) => update("indexerUrl", e.currentTarget.value)}
            placeholder="(unset → falls back to RPC log scan)"
            styles={monoInputStyles}
          />

          <NumberInput
            id="settings-fee"
            label="Max anti-spam fee (gwei)"
            min={0}
            value={draft.maxFeeGwei || ""}
            onChange={(v) => update("maxFeeGwei", Number(v) || 0)}
            placeholder="0"
            allowDecimal={false}
            allowNegative={false}
          />

          <PasswordInput
            id="settings-pinata"
            label="Pinata JWT"
            value={draft.pinataJwt}
            onChange={(e) => update("pinataJwt", e.currentTarget.value)}
            placeholder="(required to send mail)"
            autoComplete="off"
            description={
              <>
                Used to pin encrypted mail to IPFS. Generate a scoped
                "pinFileToIPFS / pinJSONToIPFS" key at pinata.cloud. Stored only
                in this browser's localStorage.
              </>
            }
            styles={monoInputStyles}
          />
          {draft.pinataJwt && (
            <Stack gap="xs">
              <Text size="xs" c="red">
                Warning: the JWT is stored UNENCRYPTED in this browser's
                localStorage, readable by any script on this origin (e.g. via
                XSS). Use a scoped key and clear it when done. See{" "}
                <Anchor
                  href="https://github.com/dantaik/heed/blob/main/SECURITY.md"
                  target="_blank"
                  rel="noreferrer"
                  size="xs"
                >
                  SECURITY.md
                </Anchor>
                .
              </Text>
              <Group>
                <Button variant="default" size="sm" onClick={onClearJwt}>
                  Clear JWT
                </Button>
              </Group>
            </Stack>
          )}

          <Group gap="xs" align="center">
            <Button onClick={onSave} disabled={!!gwError}>
              Save
            </Button>
            <Button variant="default" onClick={onReset}>
              Reset
            </Button>
            <Button variant="subtle" onClick={onClearAll}>
              Clear all settings
            </Button>
            {saved && (
              <Text size="sm" c="teal">
                Saved
              </Text>
            )}
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Backup &amp; restore</Title>
            <Text size="sm" c="dimmed">
              Export all locally cached mail, read state, drafts and settings to
              a zip file, or restore from one.
            </Text>
          </Stack>
          <Group gap="xs" align="center" wrap="wrap">
            <Button variant="default" onClick={() => setExportOpen(true)}>
              Export data
            </Button>
            <Button variant="default" onClick={() => fileRef.current?.click()}>
              Import data
            </Button>
            <Button variant="subtle" onClick={() => setResetOpen(true)}>
              Reset local store
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              style={{ display: "none" }}
              aria-label="Import backup file"
              onChange={onFile}
            />
          </Group>
          <Text size="xs" c="dimmed">
            The backup contains decrypted message content in plaintext. Keep the
            file somewhere safe.
          </Text>
        </Stack>
      </Card>

      <Modal
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export your data?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This downloads a zip file with your settings, cached mail, drafts
            and read state — including decrypted message content in plaintext.
            Anyone with the file can read your mail.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onExport}>Download backup</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        title="Restore from backup?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Merge keeps your current data and adds the backup's. Replace wipes
            local data first, then restores the backup exactly.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={() => onImport("replace")}>
              Replace
            </Button>
            <Button onClick={() => onImport("merge")}>Merge</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset local store?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This deletes cached mail, decoded content, drafts and read state on
            this device. Settings are kept, and on-chain mail will be re-fetched
            from RPC/IPFS on next load.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={onResetStore}>
              Reset
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
