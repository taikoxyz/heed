import { describe, it, expect } from "vitest";
import { envKeystore } from "../../src/keystore/env";
import { KeystoreReadOnlyError } from "../../src/keystore/types";

const PK = "0x" + "2".repeat(64);

describe("envKeystore", () => {
  it("returns null when HEED_PRIVATE_KEY is unset", async () => {
    expect(await envKeystore({}).read()).toBeNull();
  });

  it("returns the private key from HEED_PRIVATE_KEY", async () => {
    expect(await envKeystore({ HEED_PRIVATE_KEY: PK }).read()).toBe(PK);
  });

  it("throws on malformed env private key", async () => {
    await expect(envKeystore({ HEED_PRIVATE_KEY: "0xnope" }).read()).rejects.toThrow(/private key/);
  });

  it("write/remove are read-only", async () => {
    const ks = envKeystore({ HEED_PRIVATE_KEY: PK });
    await expect(ks.write(PK as `0x${string}`)).rejects.toThrow(KeystoreReadOnlyError);
    await expect(ks.remove()).rejects.toThrow(KeystoreReadOnlyError);
  });

  it("source is 'env'", () => {
    expect(envKeystore({}).source).toBe("env");
  });
});
