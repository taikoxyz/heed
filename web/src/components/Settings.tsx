import { useState } from "react";
import {
  clearSettings,
  EMPTY_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings as SettingsT,
} from "../lib/settings";
import { parseGateways } from "../lib/config";

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

  return (
    <div className="p-4 max-w-xl">
      <h2 className="text-lg mb-4">Settings</h2>
      <p className="text-xs text-gray-500 mb-4">
        Empty fields fall back to the build-time defaults. Saved to
        localStorage on this device only.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm">RPC URL</span>
          <input
            type="text"
            value={draft.rpcUrl}
            onChange={(e) => update("rpcUrl", e.target.value)}
            placeholder="https://rpc.mainnet.taiko.xyz"
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm">IPFS gateway(s)</span>
          <input
            type="text"
            value={draft.ipfsGateway}
            onChange={(e) => update("ipfsGateway", e.target.value)}
            placeholder="https://gateway.pinata.cloud,https://ipfs.io"
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
          />
          <span className="text-xs text-gray-500 mt-1 block">
            Comma-separated list, tried in order with fallback on failure.
          </span>
          {gwError && (
            <span className="text-xs text-red-600 mt-1 block">{gwError}</span>
          )}
        </label>

        <label className="block">
          <span className="text-sm">Indexer URL</span>
          <input
            type="text"
            value={draft.indexerUrl}
            onChange={(e) => update("indexerUrl", e.target.value)}
            placeholder="(unset → falls back to RPC log scan)"
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm">Max anti-spam fee (gwei)</span>
          <input
            type="number"
            min={0}
            value={draft.maxFeeGwei || ""}
            onChange={(e) =>
              update("maxFeeGwei", Number(e.target.value) || 0)
            }
            placeholder="0"
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm">Pinata JWT</span>
          <input
            type="password"
            value={draft.pinataJwt}
            onChange={(e) => update("pinataJwt", e.target.value)}
            placeholder="(required to send mail)"
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
            autoComplete="off"
          />
          <span className="text-xs text-gray-500 mt-1 block">
            Used to pin encrypted mail to IPFS. Generate a scoped
            "pinFileToIPFS / pinJSONToIPFS" key at pinata.cloud.
          </span>
          {draft.pinataJwt && (
            <span className="text-xs text-red-600 mt-1 block">
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
            </span>
          )}
          {draft.pinataJwt && (
            <button
              onClick={onClearJwt}
              className="mt-2 px-2 py-1 border rounded text-xs text-gray-600"
            >
              Clear JWT
            </button>
          )}
        </label>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          disabled={!!gwError}
          className="px-4 py-2 border rounded text-sm disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 border rounded text-sm text-gray-600"
        >
          Reset
        </button>
        <button
          onClick={onClearAll}
          className="px-4 py-2 border rounded text-sm text-red-600"
        >
          Clear all settings
        </button>
        {saved && (
          <span className="text-sm text-green-600 self-center">Saved.</span>
        )}
      </div>
    </div>
  );
}
