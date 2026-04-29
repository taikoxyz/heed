import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { buildProgram } from "../../src/index";
import { fileKeystore } from "../../src/keystore/file";

const PK = "0x" + "5".repeat(64);
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
  dir = await mkdtemp(join(tmpdir(), "heed-agent-e2e-"));
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
  errSpy = vi.spyOn(process.stderr, "write").mockImplementation(((chunk: unknown) => {
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

describe("heed agent", () => {
  it("show prints null address + empty identity when nothing is configured", async () => {
    await run("agent", "show");
    const out = JSON.parse(logs.at(-1)!) as { address: string | null; name: string };
    expect(out.address).toBeNull();
    expect(out.name).toBe("");
  });

  it("set-uri persists to config and shows up in agent show", async () => {
    await run("agent", "set-uri", "erc8004:taiko:42");
    await run("agent", "show");
    const out = JSON.parse(logs.at(-1)!) as { uri: string };
    expect(out.uri).toBe("erc8004:taiko:42");
  });

  it("set-name + set-owner-url + set-logo-cid all round-trip through show", async () => {
    await run("agent", "set-name", "Claude Code");
    await run("agent", "set-owner-url", "https://claude.com");
    await run("agent", "set-logo-cid", "bafybeigdyrztest");
    await run("agent", "show");
    const out = JSON.parse(logs.at(-1)!) as { name: string; owner_url: string; logo_cid: string };
    expect(out.name).toBe("Claude Code");
    expect(out.owner_url).toBe("https://claude.com");
    expect(out.logo_cid).toBe("bafybeigdyrztest");
  });

  it("show includes the wallet address when a key is loaded from file", async () => {
    await fileKeystore(join(dir, "wallet.json")).write(PK as `0x${string}`);
    await run("agent", "show");
    const out = JSON.parse(logs.at(-1)!) as { address: string };
    expect(out.address.toLowerCase()).toBe(ACCOUNT.address.toLowerCase());
  });

  it("show includes the address from HEED_PRIVATE_KEY", async () => {
    process.env.HEED_PRIVATE_KEY = PK;
    await run("agent", "show");
    const out = JSON.parse(logs.at(-1)!) as { address: string };
    expect(out.address.toLowerCase()).toBe(ACCOUNT.address.toLowerCase());
  });
});

describe("heed setup --no-publish (end-to-end through commander)", () => {
  it("generates a wallet and saves it to file when --no-publish is passed", async () => {
    await run("setup", "--no-publish");
    expect(process.exitCode).toBeFalsy();
    const out = JSON.parse(logs.at(-1)!) as {
      address: string;
      encryptionPub: string;
      keyNonce: number;
      txHash?: string;
    };
    expect(out.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(out.encryptionPub).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(out.keyNonce).toBe(0);
    expect(out.txHash).toBeUndefined();
    expect(errs.join("")).toMatch(/encryption key not yet published/);
    const wallet = JSON.parse(await readFile(join(dir, "wallet.json"), "utf8")) as { privateKey: string };
    expect(wallet.privateKey).toMatch(/^0x[0-9a-f]{64}$/i);
    expect((await stat(join(dir, "wallet.json"))).mode & 0o777).toBe(0o600);
  });

  it("refuses to overwrite an existing wallet without --force", async () => {
    await run("setup", "--no-publish");
    logs.length = 0;
    errs.length = 0;
    await run("setup", "--no-publish");
    expect(process.exitCode).toBe(1);
    expect(errs.join("")).toMatch(/already configured/);
  });

  it("imports a specified private key", async () => {
    await run("setup", "--no-publish", "--import-private-key", PK);
    const out = JSON.parse(logs.at(-1)!) as { address: string };
    expect(out.address.toLowerCase()).toBe(ACCOUNT.address.toLowerCase());
  });

  it("errors when no rpc_url is configured and --no-publish is not set", async () => {
    await run("setup");
    expect(process.exitCode).toBe(1);
    expect(errs.join("")).toMatch(/RPC/);
  });
});
