import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
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
    <MantineProvider>
      <QueryClientProvider client={client}>
        <Settings />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("Settings persistence", () => {
  beforeEach(() => {
    clearSettings();
  });

  it("round-trips through localStorage", () => {
    const written: SettingsT = {
      rpcUrl: "https://example.org/rpc",
      ipfsGateway: "https://gw.example.org",
      indexerUrl: "https://indexer.example.org/graphql",
      maxFeeGwei: 42,
      pinataJwt: "eyJfake.jwt.value",
    };
    saveSettings(written);
    expect(loadSettings()).toEqual(written);
  });

  it("returns empty defaults when nothing is saved", () => {
    expect(loadSettings()).toEqual({
      rpcUrl: "",
      ipfsGateway: "",
      indexerUrl: "",
      maxFeeGwei: 0,
      pinataJwt: "",
    });
  });

  it("Settings UI saves edits to localStorage", () => {
    renderSettings();
    const rpc = screen.getByPlaceholderText(
      "https://rpc.mainnet.taiko.xyz",
    ) as HTMLInputElement;
    fireEvent.change(rpc, { target: { value: "https://custom.rpc" } });
    fireEvent.click(screen.getByText("Save"));

    expect(loadSettings().rpcUrl).toBe("https://custom.rpc");
    expect(screen.getByText("Saved")).toBeTruthy();
  });
});
