import { describe, it, expect } from "vitest";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HEED_ABI } from "../../src/contract/abi";
import { createReadClient, createWriteClient } from "../../src/contract/client";

const DEAD_ADDR = "0x000000000000000000000000000000000000dead" as const;

describe("HEED_ABI", () => {
  it("includes all required external functions", () => {
    const fnNames = new Set(
      HEED_ABI.filter((x: any) => x.type === "function").map((x: any) => x.name),
    );
    for (const required of [
      "getInbox",
      "getInboxes",
      "feeGwei",
      "trusts",
      "publishKey",
      "setFee",
      "trust",
      "untrust",
      "sendBatch",
    ]) {
      expect(fnNames.has(required), `missing function: ${required}`).toBe(true);
    }
  });
});

describe("createReadClient", () => {
  it("exposes typed reader methods", () => {
    const pub = createPublicClient({ transport: http("http://127.0.0.1:1") });
    const c = createReadClient(pub, DEAD_ADDR);
    expect(typeof c.getInbox).toBe("function");
    expect(typeof c.getInboxes).toBe("function");
    expect(typeof c.feeGwei).toBe("function");
    expect(typeof c.trusts).toBe("function");
  });
});

describe("createWriteClient", () => {
  it("exposes typed writer methods", () => {
    const account = privateKeyToAccount(("0x" + "1".repeat(64)) as `0x${string}`);
    const wallet = createWalletClient({ account, transport: http("http://127.0.0.1:1") });
    const c = createWriteClient(wallet, DEAD_ADDR);
    expect(typeof c.publishKey).toBe("function");
    expect(typeof c.setFee).toBe("function");
    expect(typeof c.trust).toBe("function");
    expect(typeof c.untrust).toBe("function");
    expect(typeof c.sendBatch).toBe("function");
  });
});
