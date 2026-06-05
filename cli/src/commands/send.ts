import { Command } from "commander";
import { pinJson, type Urgency } from "@heed/core";
import type { Address, Hex } from "viem";
import { resolvePaths } from "../config/paths";
import { readConfig } from "../config/store";
import { selectKeystore, type KeystoreOverride } from "../keystore";
import { runSend, runSendDryRun, type SendArgs } from "../lib/send";
import { lookupRecipient, sendBatchOnChain } from "../lib/chain";

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
    .action(async (recipient: string, opts: SendCliOpts) => {
      try {
        if (!/^0x[0-9a-fA-F]{40}$/.test(recipient))
          throw new Error("recipient must be a 0x-prefixed 40-char address");
        if (!URGENCY_VALUES.includes(opts.urgency))
          throw new Error(
            `urgency must be one of: ${URGENCY_VALUES.join(", ")}`,
          );
        if (opts.body !== undefined && opts.bodyFromStdin)
          throw new Error(
            "--body and --body-from-stdin are mutually exclusive",
          );

        const body = opts.bodyFromStdin ? await readStdin() : (opts.body ?? "");
        const args: SendArgs = {
          to: recipient as Address,
          title: opts.title,
          body,
          urgency: opts.urgency,
          ...(opts.actionUrl !== undefined && { actionUrl: opts.actionUrl }),
          ...(opts.replyTo !== undefined && { replyTo: opts.replyTo }),
        };

        const paths = resolvePaths();
        const config = await readConfig(paths.configFile);
        const ks = selectKeystore({
          walletFile: paths.walletFile,
          override: opts.keystore,
        });
        const privateKey = await ks.read();
        if (!privateKey)
          throw new Error(
            "no key loaded. run `heed setup` first or set HEED_PRIVATE_KEY.",
          );

        const rpcUrl = opts.rpcUrl ?? config.network.rpc_url;
        if (!rpcUrl)
          throw new Error(
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
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const pinataJwt = process.env.HEED_PINATA_JWT;
        if (!pinataJwt)
          throw new Error(
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
          sendBatch: ({ mails, totalValueWei }) =>
            sendBatchOnChain({
              privateKey,
              rpcUrl,
              chainId: config.network.chain_id,
              contract: config.network.contract,
              mails,
              totalValueWei,
            }),
          now: () => Date.now(),
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
