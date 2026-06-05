import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { buildProgram } from "../src/index";

const PK = "0x" + "4".repeat(64);
const ACCOUNT = privateKeyToAccount(PK as `0x${string}`);

let dir: string;
let originalEnv: NodeJS.ProcessEnv;
let logs: string[];
let errs: string[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let logSpy: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let errSpy: any;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "heed-cli-e2e-"));
  originalEnv = { ...process.env };
  process.env = { ...originalEnv, HEED_HOME: dir };
  delete process.env.HEED_PRIVATE_KEY;
  delete process.env.XDG_CONFIG_HOME;
  process.exitCode = undefined;
  logs = [];
  errs = [];
  logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
    logs.push(String(msg));
  });
  errSpy = vi.spyOn(process.stderr, "write").mockImplementation(((
    chunk: unknown,
  ) => {
    errs.push(String(chunk));
    return true;
  }) as never);
});

afterEach(async () => {
  process.env = originalEnv;
  process.exitCode = undefined;
  logSpy.mockRestore();
  errSpy.mockRestore();
  await rm(dir, { recursive: true, force: true });
});

async function run(...args: string[]) {
  await buildProgram().parseAsync(["node", "heed", ...args]);
}

describe("heed config", () => {
  it("path prints the resolved config file path", async () => {
    await run("config", "path");
    expect(logs.at(-1)).toBe(join(dir, "config.json"));
  });

  it("set then get round-trips a value", async () => {
    await run("config", "set", "identity.name", "Alice Bot");
    expect(process.exitCode).toBeFalsy();
    await run("config", "get", "identity.name");
    expect(logs.at(-1)).toBe("Alice Bot");
  });

  it("get with no key prints the whole config as JSON", async () => {
    await run("config", "get");
    const printed = JSON.parse(logs.at(-1)!) as Record<string, unknown>;
    expect(
      (printed as { network: { chain_id: number } }).network.chain_id,
    ).toBe(167000);
  });

  it("rejects unknown keys with BAD_INPUT (exit 2) and a JSON error envelope", async () => {
    await run("config", "set", "network.password", "x");
    expect(process.exitCode).toBe(2);
    const parsed = JSON.parse(errs.join("")) as {
      error: { code: string; message: string };
    };
    expect(parsed.error.code).toBe("BAD_INPUT");
    expect(parsed.error.message).toMatch(/unknown key/);
  });
});

describe("heed key show", () => {
  it("prints the address derived from a file-stored key", async () => {
    const { fileKeystore } = await import("../src/keystore/file");
    await fileKeystore(join(dir, "wallet.json")).write(PK as `0x${string}`);
    await run("key", "show");
    const out = JSON.parse(logs.at(-1)!) as { address: string; source: string };
    expect(out.address.toLowerCase()).toBe(ACCOUNT.address.toLowerCase());
    expect(out.source).toBe("file");
  });

  it("prints the address derived from HEED_PRIVATE_KEY", async () => {
    process.env.HEED_PRIVATE_KEY = PK;
    await run("key", "show");
    const out = JSON.parse(logs.at(-1)!) as { address: string; source: string };
    expect(out.address.toLowerCase()).toBe(ACCOUNT.address.toLowerCase());
    expect(out.source).toBe("env");
  });

  it("emits WALLET_NOT_CONFIGURED (exit 2) as JSON on stderr when no key is set", async () => {
    await run("key", "show");
    expect(process.exitCode).toBe(2);
    const parsed = JSON.parse(errs.join("")) as {
      error: { code: string; message: string };
    };
    expect(parsed.error.code).toBe("WALLET_NOT_CONFIGURED");
    expect(parsed.error.message).toMatch(/no key found/);
  });
});
