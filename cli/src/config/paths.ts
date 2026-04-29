import { homedir } from "node:os";
import { join } from "node:path";

export interface HeedPaths {
  home: string;
  configFile: string;
  walletFile: string;
}

export function resolvePaths(env: NodeJS.ProcessEnv = process.env): HeedPaths {
  const explicit = env.HEED_HOME;
  if (explicit && explicit.length > 0) {
    return { home: explicit, configFile: join(explicit, "config.json"), walletFile: join(explicit, "wallet.json") };
  }
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  const home = join(base, "heed");
  return { home, configFile: join(home, "config.json"), walletFile: join(home, "wallet.json") };
}
