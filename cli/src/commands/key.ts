import { Command } from "commander";
import { privateKeyToAccount } from "viem/accounts";
import { resolvePaths } from "../config/paths";
import { selectKeystore, type KeystoreOverride } from "../keystore";
import { CliError, reportError } from "../lib/errors";

export function registerKeyCommand(program: Command): void {
  const key = program
    .command("key")
    .description("Inspect or rotate the agent's wallet key");

  key
    .command("show")
    .description("Print the wallet address derived from the loaded private key")
    .option("--keystore <kind>", "Keystore source: auto, file, or env", "auto")
    .action(async (opts: { keystore: KeystoreOverride }) => {
      try {
        const paths = resolvePaths();
        const ks = selectKeystore({
          walletFile: paths.walletFile,
          override: opts.keystore,
        });
        const pk = await ks.read();
        if (!pk) {
          throw new CliError(
            "WALLET_NOT_CONFIGURED",
            `no key found. run "heed setup" to create one, or set HEED_PRIVATE_KEY.`,
          );
        }
        const account = privateKeyToAccount(pk);
        console.log(
          JSON.stringify(
            { address: account.address, source: ks.source },
            null,
            2,
          ),
        );
      } catch (err) {
        reportError(err);
      }
    });
}
