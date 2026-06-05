import { Command } from "commander";
import { pinJson, type Urgency } from "@heed/core";
import type { Address, Hex } from "viem";
import { resolvePaths } from "../config/paths";
import { readConfig } from "../config/store";
import { selectKeystore, type KeystoreOverride } from "../keystore";
import { runSend, runSendDryRun, type SendArgs } from "../lib/send";
import { lookupRecipient, sendBatchOnChain } from "../lib/chain";
import { CliError, jsonReplacer, reportError } from "../lib/errors";

interface SendCliOpts {
  title: string;
  body?: string;
  bodyFromStdin?: boolean;
  urgency: Urgency;
  actionUrl?: string;
  replyTo?: Hex;
  rpcUrl?: string;
  dryRun?: boolean;
  keystore: KeystoreOverride;
  maxFeeGwei?: string;
  wait: boolean;
  bestEffort?: boolean;
}

const URGENCY_VALUES: readonly Urgency[] = ["low", "normal", "high"] as const;

export function registerSendCommand(program: Command): void {
  program
    .command("send <recipient>")
    .description(
      "Send a signed envelope to a recipient wallet, paying their on-chain fee",
    )
    .requiredOption("--title <title>", "Envelope title (≤120 chars)")
    .option("--body <body>", "Envelope body (markdown)")
    .option("--body-from-stdin", "Read the envelope body from stdin")
    .option("--urgency <urgency>", "low | normal | high", "normal")
    .option("--action-url <url>", "Optional https:// CTA the recipient can tap")
    .option(
      "--reply-to <hash>",
      "32-byte content reference of the message being replied to",
    )
    .option("--rpc-url <url>", "Override network.rpc_url")
    .option(
      "--dry-run",
      "Print the signed envelope and synthetic CID without pinning to IPFS or sending on-chain",
    )
    .option("--keystore <kind>", "Keystore source: auto, file, or env", "auto")
    .option(
      "--max-fee-gwei <gwei>",
      "Refuse with FEE_EXCEEDS_MAX if the recipient's fee exceeds this cap (in gwei)",
    )
    .option(
      "--no-wait",
      "Return as soon as the tx is submitted, without waiting for the receipt",
    )
    .option(
      "--best-effort",
      "Disable atomic delivery (the contract's atomic flag is set to false). Use only for batch sends where partial success is acceptable.",
    )
    .action(async (recipient: string, opts: SendCliOpts) => {
      try {
        if (!/^0x[0-9a-fA-F]{40}$/.test(recipient))
          throw new CliError(
            "BAD_INPUT",
            "recipient must be a 0x-prefixed 40-char address",
            { recipient },
          );
        if (!URGENCY_VALUES.includes(opts.urgency))
          throw new CliError(
            "BAD_INPUT",
            `urgency must be one of: ${URGENCY_VALUES.join(", ")}`,
            { urgency: opts.urgency },
          );
        if (opts.body !== undefined && opts.bodyFromStdin)
          throw new CliError(
            "BAD_INPUT",
            "--body and --body-from-stdin are mutually exclusive",
          );

        let maxFeeGwei: number | undefined;
        if (opts.maxFeeGwei !== undefined) {
          const n = Number(opts.maxFeeGwei);
          if (!Number.isInteger(n) || n < 0)
            throw new CliError(
              "BAD_INPUT",
              "--max-fee-gwei must be a non-negative integer",
              { value: opts.maxFeeGwei },
            );
          maxFeeGwei = n;
        }

        const body = opts.bodyFromStdin ? await readStdin() : (opts.body ?? "");
        const args: SendArgs = {
          to: recipient as Address,
          title: opts.title,
          body,
          urgency: opts.urgency,
          ...(opts.actionUrl !== undefined && { actionUrl: opts.actionUrl }),
          ...(opts.replyTo !== undefined && { replyTo: opts.replyTo }),
          ...(maxFeeGwei !== undefined && { maxFeeGwei }),
          atomic: !opts.bestEffort,
          wait: opts.wait,
        };

        const paths = resolvePaths();
        const config = await readConfig(paths.configFile);
        const ks = selectKeystore({
          walletFile: paths.walletFile,
          override: opts.keystore,
        });
        const privateKey = await ks.read();
        if (!privateKey)
          throw new CliError(
            "WALLET_NOT_CONFIGURED",
            "no key loaded. run `heed setup` first or set HEED_PRIVATE_KEY.",
          );

        const rpcUrl = opts.rpcUrl ?? config.network.rpc_url;
        if (!rpcUrl)
          throw new CliError(
            "RPC_NOT_CONFIGURED",
            "no RPC URL configured. set network.rpc_url or pass --rpc-url.",
          );

        const lookup = (addr: Address) =>
          lookupRecipient({
            rpcUrl,
            chainId: config.network.chain_id,
            contract: config.network.contract,
            recipient: addr,
          });

        if (opts.dryRun) {
          const result = await runSendDryRun(args, {
            privateKey,
            config,
            lookupRecipient: lookup,
            now: () => Date.now(),
          });
          console.log(JSON.stringify(result, jsonReplacer, 2));
          return;
        }

        const pinataJwt = process.env.HEED_PINATA_JWT;
        if (!pinataJwt)
          throw new CliError(
            "PINATA_JWT_MISSING",
            "HEED_PINATA_JWT must be set to pin encrypted bytes to IPFS.",
          );

        const result = await runSend(args, {
          privateKey,
          config,
          lookupRecipient: lookup,
          // encodeEncryptedBytes already produces JSON-encoded bytes; route
          // through pinJSONToIPFS so the returned CID is raw-codec (bafkrei…),
          // the only on-wire CID format Heed accepts.
          pin: (bytes, name) => {
            const obj = JSON.parse(new TextDecoder().decode(bytes));
            return pinJson(obj, name, { jwt: pinataJwt });
          },
          sendBatch: ({ mails, totalValueWei, atomic, wait }) =>
            sendBatchOnChain({
              privateKey,
              rpcUrl,
              chainId: config.network.chain_id,
              contract: config.network.contract,
              mails,
              totalValueWei,
              atomic,
              wait,
            }),
          now: () => Date.now(),
        });
        console.log(JSON.stringify(result, jsonReplacer, 2));
      } catch (err) {
        reportError(err);
      }
    });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
