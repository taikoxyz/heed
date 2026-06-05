import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taiko, mainnet } from "viem/chains";
import { Settings } from "../src/components/Settings";
import {
  clearSettings,
  loadSettings,
  saveSettings,
  type Settings as SettingsT,
} from "../src/lib/settings";

function renderSettings() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Settings />
    </QueryClientProvider>,
  );
}

describe("Settings persistence", () => {
  beforeEach(() => {
    clearSettings();
  });

  it("round-trips through localStorage", () => {
    const written: SettingsT = {
      networks: {
        [taiko.id]: {
          rpcUrl: "https://example.org/taiko-rpc",
          indexerUrl: "https://taiko-indexer.example.org/graphql",
          maxFeeGwei: 42,
        },
        [mainnet.id]: {
          rpcUrl: "https://example.org/eth-rpc",
          indexerUrl: "",
          maxFeeGwei: 500,
        },
      },
      ipfsGateway: "https://gw.example.org",
      pinataJwt: "eyJfake.jwt.value",
    };
    saveSettings(written);
    expect(loadSettings()).toEqual(written);
  });

  it("returns empty defaults when nothing is saved", () => {
    expect(loadSettings()).toEqual({
      networks: {
        [taiko.id]: { rpcUrl: "", indexerUrl: "", maxFeeGwei: 0 },
        [mainnet.id]: { rpcUrl: "", indexerUrl: "", maxFeeGwei: 0 },
      },
      ipfsGateway: "",
      pinataJwt: "",
    });
  });

  it("migrates the legacy flat shape into the default chain slot", () => {
    window.localStorage.setItem(
      "heed:settings",
      JSON.stringify({
        rpcUrl: "https://legacy.example/rpc",
        indexerUrl: "https://legacy.example/indexer",
        maxFeeGwei: 7,
        ipfsGateway: "https://gw.legacy.example",
        pinataJwt: "legacy.jwt",
      }),
    );
    const loaded = loadSettings();
    expect(loaded.networks[taiko.id]).toEqual({
      rpcUrl: "https://legacy.example/rpc",
      indexerUrl: "https://legacy.example/indexer",
      maxFeeGwei: 7,
    });
    expect(loaded.networks[mainnet.id]).toEqual({
      rpcUrl: "",
      indexerUrl: "",
      maxFeeGwei: 0,
    });
    expect(loaded.ipfsGateway).toBe("https://gw.legacy.example");
    expect(loaded.pinataJwt).toBe("legacy.jwt");
  });

  it("Settings UI saves Taiko RPC edits to localStorage", () => {
    renderSettings();
    const rpc = screen.getByPlaceholderText(
      "https://rpc.mainnet.taiko.xyz",
    ) as HTMLInputElement;
    fireEvent.change(rpc, { target: { value: "https://custom.rpc" } });
    fireEvent.click(screen.getByText("Save"));

    expect(loadSettings().networks[taiko.id]!.rpcUrl).toBe(
      "https://custom.rpc",
    );
    expect(screen.getByText("Saved")).toBeTruthy();
  });
});
