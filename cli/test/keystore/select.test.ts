import { describe, it, expect } from "vitest";
import { selectKeystore } from "../../src/keystore";

const PK = "0x" + "3".repeat(64);

describe("selectKeystore", () => {
  it("prefers env when HEED_PRIVATE_KEY is set and override is auto", () => {
    expect(
      selectKeystore({
        walletFile: "/tmp/heed-test/wallet.json",
        override: "auto",
        env: { HEED_PRIVATE_KEY: PK },
      }).source,
    ).toBe("env");
  });

  it("falls back to file when HEED_PRIVATE_KEY is unset", () => {
    expect(
      selectKeystore({
        walletFile: "/tmp/heed-test/wallet.json",
        override: "auto",
        env: {},
      }).source,
    ).toBe("file");
  });

  it("respects --keystore=file override even when env is set", () => {
    expect(
      selectKeystore({
        walletFile: "/tmp/heed-test/wallet.json",
        override: "file",
        env: { HEED_PRIVATE_KEY: PK },
      }).source,
    ).toBe("file");
  });

  it("respects --keystore=env override", () => {
    expect(
      selectKeystore({
        walletFile: "/tmp/heed-test/wallet.json",
        override: "env",
        env: {},
      }).source,
    ).toBe("env");
  });
});
