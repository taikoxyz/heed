import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileKeystore } from "../../src/keystore/file";

const PK = ("0x" + "1".repeat(64)) as `0x${string}`;
let dir: string;
let walletFile: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "heed-keystore-"));
  walletFile = join(dir, "wallet.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("fileKeystore", () => {
  it("returns null when the wallet file does not exist", async () => {
    expect(await fileKeystore(walletFile).read()).toBeNull();
  });

  it("round-trips a private key through write -> read", async () => {
    const ks = fileKeystore(walletFile);
    await ks.write(PK);
    expect(await ks.read()).toBe(PK);
  });

  it("writes the wallet file with mode 0600", async () => {
    await fileKeystore(walletFile).write(PK);
    expect((await stat(walletFile)).mode & 0o777).toBe(0o600);
  });

  it("removes the wallet file", async () => {
    const ks = fileKeystore(walletFile);
    await ks.write(PK);
    await ks.remove();
    expect(await ks.read()).toBeNull();
  });

  it("remove is idempotent", async () => {
    await expect(fileKeystore(walletFile).remove()).resolves.toBeUndefined();
  });

  it("rejects malformed private keys", async () => {
    await expect(fileKeystore(walletFile).write("0xnope" as `0x${string}`)).rejects.toThrow(/private key/);
  });

  it("source is 'file'", () => {
    expect(fileKeystore(walletFile).source).toBe("file");
  });
});
