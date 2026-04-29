import { Command } from "commander";
import type { Address, Hash, Hex } from "viem";
import { resolvePaths } from "../config/paths";
import { readConfig, writeConfig, type HeedConfig } from "../config/store";
import { selectKeystore, assertPrivateKey, type Keystore, type KeystoreOverride } from "../keystore";
import { deriveAgentKeys, generatePrivateKey } from "../lib/derive";
import { publishKeyOnChain } from "../lib/chain";

export interface SetupArgs {
  importPrivateKey?: Hex;
  rpcUrl?: string;
  noPublish?: boolean;
  force?: boolean;
}

export interface SetupDeps {
  keystore: Keystore;
  config: HeedConfig;
  saveConfig: (next: HeedConfig) => Promise<void>;
  publishKey: (args: {
    privateKey: Hex;
    rpcUrl: string;
    chainId: number;
    contract: Address;
    keyNonce: number;
    pub: Hex;
  }) => Promise<Hash>;
  generate: () => Hex;
}

export interface SetupResult {
  address: Address;
  encryptionPub: Hex;
  keyNonce: number;
  txHash: Hash | undefined;
  imported: boolean;
}

export async function runSetup(args: SetupArgs, deps: SetupDeps): Promise<SetupResult> {
  const existing = await deps.keystore.read();
  if (existing && !args.force && !args.importPrivateKey) {
    throw new Error("a wallet is already configured. pass --force to overwrite, or --import-private-key to replace it");
  }

  const privateKey = args.importPrivateKey ?? (existing && !args.force ? existing : deps.generate());
  assertPrivateKey(privateKey);
  const imported = args.importPrivateKey !== undefined;

  if (!existing || args.force || args.importPrivateKey) {
    await deps.keystore.write(privateKey);
  }

  const keyNonce = deps.config.key_nonce;
  const keys = await deriveAgentKeys({
    privateKey,
    chainId: deps.config.network.chain_id,
    contract: deps.config.network.contract,
    keyNonce,
  });

  let txHash: Hash | undefined;
  if (!args.noPublish) {
    const rpcUrl = args.rpcUrl ?? deps.config.network.rpc_url;
    if (!rpcUrl) {
      throw new Error("no RPC URL configured. pass --rpc-url, set network.rpc_url via `heed config set`, or use --no-publish");
    }
    txHash = await deps.publishKey({
      privateKey,
      rpcUrl,
      chainId: deps.config.network.chain_id,
      contract: deps.config.network.contract,
      keyNonce,
      pub: keys.encryptionPub,
    });
  }

  await deps.saveConfig({ ...deps.config, key_nonce: keyNonce });

  return { address: keys.address, encryptionPub: keys.encryptionPub, keyNonce, txHash, imported };
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Generate or import a wallet, derive the encryption key, and publish it on-chain")
    .option("--import-private-key <hex>", "Import an existing 0x-prefixed 64-char private key")
    .option("--rpc-url <url>", "Override network.rpc_url for the publishKey transaction")
    .option("--no-publish", "Generate keys without sending the publishKey transaction (useful offline)")
    .option("-f, --force", "Overwrite an existing wallet")
    .option("--keystore <kind>", "Keystore source: auto, file, or env", "auto")
    .action(async (opts: { importPrivateKey?: Hex; rpcUrl?: string; publish: boolean; force?: boolean; keystore: KeystoreOverride }) => {
      const paths = resolvePaths();
      const ks = selectKeystore({ walletFile: paths.walletFile, override: opts.keystore });
      const config = await readConfig(paths.configFile);
      try {
        const args: SetupArgs = {
          ...(opts.importPrivateKey !== undefined && { importPrivateKey: opts.importPrivateKey }),
          ...(opts.rpcUrl !== undefined && { rpcUrl: opts.rpcUrl }),
          ...(opts.publish === false && { noPublish: true }),
          ...(opts.force !== undefined && { force: opts.force }),
        };
        const result = await runSetup(args, {
          keystore: ks,
          config,
          saveConfig: (next) => writeConfig(paths.configFile, next),
          publishKey: publishKeyOnChain,
          generate: generatePrivateKey,
        });
        console.log(JSON.stringify(result, null, 2));
        if (!result.txHash) {
          process.stderr.write(
            "wallet ready, encryption key not yet published on-chain. fund the address and re-run `heed setup` (or rerun without --no-publish).\n",
          );
        }
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });
}
