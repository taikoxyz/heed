import { describe, it, expect } from "vitest";
import { resolvePaths } from "../../src/config/paths";

describe("resolvePaths", () => {
  it("uses HEED_HOME when set", () => {
    const p = resolvePaths({ HEED_HOME: "/tmp/heed-test" });
    expect(p.home).toBe("/tmp/heed-test");
    expect(p.configFile).toBe("/tmp/heed-test/config.json");
    expect(p.walletFile).toBe("/tmp/heed-test/wallet.json");
  });

  it("uses XDG_CONFIG_HOME/heed when HEED_HOME is unset", () => {
    const p = resolvePaths({ XDG_CONFIG_HOME: "/custom/xdg" });
    expect(p.home).toBe("/custom/xdg/heed");
    expect(p.configFile).toBe("/custom/xdg/heed/config.json");
  });

  it("falls back to ~/.config/heed when neither is set", () => {
    const p = resolvePaths({});
    expect(p.home.endsWith("/.config/heed")).toBe(true);
  });
});
