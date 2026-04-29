import { Command } from "commander";
import { privateKeyToAccount } from "viem/accounts";
import { resolvePaths } from "../config/paths";
import { readConfig, setValue, writeConfig, type AllowedKey } from "../config/store";
import { selectKeystore, type KeystoreOverride } from "../keystore";

export function registerAgentCommand(program: Command): void {
  const agent = program.command("agent").description("Manage the agent's claimed envelope identity (name, owner_url, uri)");

  agent
    .command("show")
    .description("Print the agent's wallet address and identity claims")
    .option("--keystore <kind>", "Keystore source: auto, file, or env", "auto")
    .action(async (opts: { keystore: KeystoreOverride }) => {
      const paths = resolvePaths();
      const cfg = await readConfig(paths.configFile);
      const ks = selectKeystore({ walletFile: paths.walletFile, override: opts.keystore });
      const pk = await ks.read();
      const address = pk ? privateKeyToAccount(pk).address : null;
      console.log(
        JSON.stringify(
          {
            address,
            name: cfg.identity.name,
            owner_url: cfg.identity.owner_url,
            logo_cid: cfg.identity.logo_cid,
            uri: cfg.identity.uri,
            key_nonce: cfg.key_nonce,
          },
          null,
          2,
        ),
      );
    });

  registerSetter(agent, "set-name", "identity.name", "Set the agent's claimed name (envelope from.name)");
  registerSetter(agent, "set-owner-url", "identity.owner_url", "Set the agent's owner URL (envelope from.owner_url)");
  registerSetter(agent, "set-uri", "identity.uri", "Set the agent's free-form identity URI (envelope from.uri)");
  registerSetter(agent, "set-logo-cid", "identity.logo_cid", "Set the agent's logo CID (envelope from.logo_cid)");
}

function registerSetter(parent: Command, name: string, key: AllowedKey, description: string): void {
  parent
    .command(`${name} <value>`)
    .description(description)
    .action(async (value: string) => {
      const paths = resolvePaths();
      const next = setValue(await readConfig(paths.configFile), key, value);
      await writeConfig(paths.configFile, next);
      console.log(`set ${key} = ${value}`);
    });
}
