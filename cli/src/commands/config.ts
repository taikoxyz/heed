import { Command } from "commander";
import {
  ALLOWED_KEYS,
  applyNetworkPreset,
  getValue,
  isAllowedKey,
  NETWORK_NAMES,
  NETWORK_PRESETS,
  readConfig,
  setValue,
  writeConfig,
} from "../config/store";
import { resolvePaths } from "../config/paths";

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Read and write Heed CLI configuration");

  config
    .command("path")
    .description("Print the config file path")
    .action(() => {
      console.log(resolvePaths().configFile);
    });

  config
    .command("get [key]")
    .description("Print the value at a config key, or the whole config")
    .action(async (key?: string) => {
      const cfg = await readConfig(resolvePaths().configFile);
      if (!key) {
        console.log(JSON.stringify(cfg, null, 2));
        return;
      }
      if (!isAllowedKey(key)) {
        process.stderr.write(
          `unknown key "${key}". allowed: ${ALLOWED_KEYS.join(", ")}\n`,
        );
        process.exitCode = 1;
        return;
      }
      const value = getValue(cfg, key);
      if (value === undefined) return;
      console.log(value);
    });

  config
    .command("set <key> <value>")
    .description("Set a config value")
    .action(async (key: string, value: string) => {
      if (!isAllowedKey(key)) {
        process.stderr.write(
          `unknown key "${key}". allowed: ${ALLOWED_KEYS.join(", ")}\n`,
        );
        process.exitCode = 1;
        return;
      }
      const paths = resolvePaths();
      const next = setValue(await readConfig(paths.configFile), key, value);
      await writeConfig(paths.configFile, next);
      console.log(`set ${key} = ${value}`);
    });

  config
    .command("use-network <name>")
    .description(`Switch to a network preset (${NETWORK_NAMES.join(" | ")})`)
    .action(async (name: string) => {
      const preset = NETWORK_PRESETS[name];
      if (!preset) {
        process.stderr.write(
          `unknown network "${name}". available: ${NETWORK_NAMES.join(", ")}\n`,
        );
        process.exitCode = 1;
        return;
      }
      const paths = resolvePaths();
      const next = applyNetworkPreset(await readConfig(paths.configFile), name);
      await writeConfig(paths.configFile, next);
      console.log(`switched to ${preset.label} (chain ${preset.chain_id})`);
      console.log(`  contract ${preset.contract}`);
      console.log(`  rpc      ${preset.rpc_url}`);
      console.log(
        `note: encryption keys are per-network — run "heed setup" to publish your key here.`,
      );
    });
}
