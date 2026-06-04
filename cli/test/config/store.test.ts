import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyNetworkPreset,
  defaultConfig,
  getValue,
  isAllowedKey,
  readConfig,
  setValue,
  writeConfig,
  HEED_ETHEREUM_CHAIN_ID,
  HEED_MAINNET_CHAIN_ID,
  HEED_MAINNET_CONTRACT,
} from "../../src/config/store";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "heed-cli-store-"));
  file = join(dir, "config.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readConfig / writeConfig", () => {
  it("returns defaults when the file does not exist", async () => {
    const cfg = await readConfig(file);
    expect(cfg).toEqual(defaultConfig());
    expect(cfg.network.chain_id).toBe(HEED_MAINNET_CHAIN_ID);
    expect(cfg.network.contract).toBe(HEED_MAINNET_CONTRACT);
  });

  it("round-trips writes through reads", async () => {
    const cfg = setValue(defaultConfig(), "identity.name", "Alice Bot");
    await writeConfig(file, cfg);
    expect(await readConfig(file)).toEqual(cfg);
  });

  it("merges partial files with defaults so older configs keep working", async () => {
    await writeConfig(file, { ...defaultConfig(), key_nonce: 7 });
    const raw = await readFile(file, "utf8");
    expect(JSON.parse(raw).key_nonce).toBe(7);
    const reread = await readConfig(file);
    expect(reread.network.contract).toBe(HEED_MAINNET_CONTRACT);
    expect(reread.key_nonce).toBe(7);
  });

  it("writes with mode 0600", async () => {
    await writeConfig(file, defaultConfig());
    const s = await stat(file);
    expect(s.mode & 0o777).toBe(0o600);
  });
});

describe("setValue", () => {
  it("rejects malformed contract addresses", () => {
    expect(() =>
      setValue(defaultConfig(), "network.contract", "0xnope"),
    ).toThrow(/contract/);
  });

  it("rejects non-integer chain ids", () => {
    expect(() => setValue(defaultConfig(), "network.chain_id", "1.5")).toThrow(
      /chain_id/,
    );
  });

  it("accepts and stores a valid contract address", () => {
    const next = setValue(
      defaultConfig(),
      "network.contract",
      "0x" + "ab".repeat(20),
    );
    expect(next.network.contract).toBe("0x" + "ab".repeat(20));
  });

  it("sets identity URI as a free-form string", () => {
    const next = setValue(defaultConfig(), "identity.uri", "erc8004:taiko:42");
    expect(getValue(next, "identity.uri")).toBe("erc8004:taiko:42");
  });
});

describe("applyNetworkPreset", () => {
  it("switches the whole network block to Ethereum, same contract address", () => {
    const next = applyNetworkPreset(defaultConfig(), "ethereum");
    expect(next.network.chain_id).toBe(HEED_ETHEREUM_CHAIN_ID);
    expect(next.network.contract).toBe(HEED_MAINNET_CONTRACT);
    expect(next.network.rpc_url).toMatch(/^https:\/\//);
    expect(next.network.deployed_at_block).toBeGreaterThan(0);
  });

  it("switches back to Taiko", () => {
    const eth = applyNetworkPreset(defaultConfig(), "ethereum");
    const taiko = applyNetworkPreset(eth, "taiko");
    expect(taiko.network.chain_id).toBe(HEED_MAINNET_CHAIN_ID);
  });

  it("preserves identity and key_nonce across a switch", () => {
    const base = {
      ...defaultConfig(),
      key_nonce: 4,
      identity: { name: "Bot", owner_url: "x" },
    };
    const next = applyNetworkPreset(base, "ethereum");
    expect(next.key_nonce).toBe(4);
    expect(next.identity).toEqual(base.identity);
  });

  it("throws on an unknown network", () => {
    expect(() => applyNetworkPreset(defaultConfig(), "solana")).toThrow(
      /unknown network/,
    );
  });
});

describe("isAllowedKey", () => {
  it("recognizes known keys", () => {
    expect(isAllowedKey("network.contract")).toBe(true);
    expect(isAllowedKey("identity.uri")).toBe(true);
    expect(isAllowedKey("key_nonce")).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(isAllowedKey("network.password")).toBe(false);
    expect(isAllowedKey("identity")).toBe(false);
  });
});
