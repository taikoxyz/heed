import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Address, Hash, Hex } from "viem";
import { runSetup, type SetupDeps } from "../../src/commands/setup";
import { defaultConfig, type HeedConfig } from "../../src/config/store";
import { fileKeystore } from "../../src/keystore/file";

const STATIC_PK: Hex = `0x${"a".repeat(64)}`;
const ALT_PK: Hex = `0x${"b".repeat(64)}`;
const FAKE_TX: Hash = `0x${"f".repeat(64)}`;

let dir: string;
let walletFile: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "heed-setup-"));
  walletFile = join(dir, "wallet.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function makeDeps(overrides: Partial<SetupDeps> = {}): {
  deps: SetupDeps;
  config: HeedConfig;
  publishKey: ReturnType<typeof vi.fn>;
  saveConfig: ReturnType<typeof vi.fn>;
} {
  const config: HeedConfig = {
    ...defaultConfig(),
    network: { ...defaultConfig().network, rpc_url: "http://localhost:8545" },
  };
  const publishKey = vi.fn(async () => FAKE_TX);
  const saveConfig = vi.fn(async () => {});
  const deps: SetupDeps = {
    keystore: fileKeystore(walletFile),
    config,
    saveConfig,
    publishKey,
    generate: () => STATIC_PK,
    ...overrides,
  };
  return { deps, config, publishKey, saveConfig };
}

describe("runSetup", () => {
  it("generates a fresh key, derives encryption keys, and publishes on-chain", async () => {
    const { deps, config, publishKey, saveConfig } = makeDeps();
    const result = await runSetup({}, deps);

    expect(result.imported).toBe(false);
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.encryptionPub).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(result.keyNonce).toBe(0);
    expect(result.txHash).toBe(FAKE_TX);

    expect(publishKey).toHaveBeenCalledTimes(1);
    const call = publishKey.mock.calls[0]![0] as Parameters<SetupDeps["publishKey"]>[0];
    expect(call.privateKey).toBe(STATIC_PK);
    expect(call.rpcUrl).toBe("http://localhost:8545");
    expect(call.contract).toBe(config.network.contract);
    expect(call.keyNonce).toBe(0);
    expect(call.pub).toBe(result.encryptionPub);

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(await fileKeystore(walletFile).read()).toBe(STATIC_PK);
  });

  it("imports a private key when --import-private-key is provided", async () => {
    const { deps, publishKey } = makeDeps();
    const result = await runSetup({ importPrivateKey: ALT_PK }, deps);

    expect(result.imported).toBe(true);
    const callPk = publishKey.mock.calls[0]![0] as { privateKey: Hex };
    expect(callPk.privateKey).toBe(ALT_PK);
    expect(await fileKeystore(walletFile).read()).toBe(ALT_PK);
  });

  it("refuses to overwrite an existing wallet without --force or --import-private-key", async () => {
    const { deps } = makeDeps();
    await fileKeystore(walletFile).write(ALT_PK);
    await expect(runSetup({}, deps)).rejects.toThrow(/already configured/);
  });

  it("overwrites with --force", async () => {
    const { deps } = makeDeps();
    await fileKeystore(walletFile).write(ALT_PK);
    const result = await runSetup({ force: true }, deps);
    expect(result.address).not.toBe("0x");
    expect(await fileKeystore(walletFile).read()).toBe(STATIC_PK);
  });

  it("overwrites with --import-private-key without requiring --force", async () => {
    const { deps } = makeDeps();
    await fileKeystore(walletFile).write(STATIC_PK);
    await runSetup({ importPrivateKey: ALT_PK }, deps);
    expect(await fileKeystore(walletFile).read()).toBe(ALT_PK);
  });

  it("--no-publish skips the on-chain call", async () => {
    const { deps, publishKey } = makeDeps();
    const result = await runSetup({ noPublish: true }, deps);
    expect(result.txHash).toBeUndefined();
    expect(publishKey).not.toHaveBeenCalled();
  });

  it("requires an RPC URL when publishing", async () => {
    const { deps } = makeDeps({ config: defaultConfig() });
    await expect(runSetup({}, deps)).rejects.toThrow(/RPC/);
  });

  it("--rpc-url overrides config", async () => {
    const { deps, publishKey } = makeDeps();
    await runSetup({ rpcUrl: "http://override:9000" }, deps);
    const call = publishKey.mock.calls[0]![0] as { rpcUrl: string };
    expect(call.rpcUrl).toBe("http://override:9000");
  });

  it("respects the existing key_nonce from config (does not auto-bump)", async () => {
    const config = { ...defaultConfig(), network: { ...defaultConfig().network, rpc_url: "http://x" }, key_nonce: 7 };
    const { deps, publishKey } = makeDeps({ config });
    const result = await runSetup({}, deps);
    expect(result.keyNonce).toBe(7);
    const call = publishKey.mock.calls[0]![0] as { keyNonce: number };
    expect(call.keyNonce).toBe(7);
  });

  it("rejects malformed --import-private-key", async () => {
    const { deps } = makeDeps();
    await expect(
      runSetup({ importPrivateKey: "0xnope" as `0x${string}` }, deps),
    ).rejects.toThrow(/private key/);
  });
});
