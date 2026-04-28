import { useState } from "react";
import {
  EMPTY_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings as SettingsT,
} from "../lib/settings";

export function Settings() {
  const [draft, setDraft] = useState<SettingsT>(loadSettings);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof SettingsT>(key: K, value: SettingsT[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function onSave() {
    saveSettings(draft);
    setSaved(true);
  }

  function onReset() {
    setDraft(EMPTY_SETTINGS);
    saveSettings(EMPTY_SETTINGS);
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
          <span className="text-sm">IPFS gateway</span>
          <input
            type="text"
            value={draft.ipfsGateway}
            onChange={(e) => update("ipfsGateway", e.target.value)}
            placeholder="https://gateway.pinata.cloud"
            className="mt-1 w-full border rounded px-2 py-1 font-mono text-sm"
          />
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
            "pinFileToIPFS / pinJSONToIPFS" key at pinata.cloud. Stored only
            in this browser's localStorage.
          </span>
        </label>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          className="px-4 py-2 border rounded text-sm"
        >
          Save
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 border rounded text-sm text-gray-600"
        >
          Reset
        </button>
        {saved && (
          <span className="text-sm text-green-600 self-center">Saved.</span>
        )}
      </div>
    </div>
  );
}
