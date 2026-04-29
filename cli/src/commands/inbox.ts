import { Command } from "commander";
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";
import { resolvePaths } from "../config/paths";
import { readConfig } from "../config/store";
import { selectKeystore, type KeystoreOverride } from "../keystore";
import { deriveAgentKeys } from "../lib/derive";
import { buildMailSource, fetchByContentRef } from "../lib/chain";
import {
  runInboxList,
  watchInbox,
  type InboxMessage,
} from "../lib/inbox";

interface InboxCliOpts {
  sinceBlock?: string;
  limit?: string;
  json?: boolean;
  watch?: boolean;
  rpcUrl?: string;
  gateway?: string;
  keystore: KeystoreOverride;
}

export function registerInboxCommand(program: Command): void {
  program
    .command("inbox")
    .description("List the agent's inbox: encrypted mail decrypted, decoded, and signature-verified")
    .option("--since-block <n>", "Only show messages mined at or after this block number")
    .option("--limit <n>", "Cap the number of historical messages (default 50)", "50")
    .option("--json", "Print machine-readable JSON instead of compact text")
    .option("--watch", "After the historical list, keep listening for new messages until interrupted")
    .option("--rpc-url <url>", "Override network.rpc_url")
    .option("--gateway <url>", "Override network.gateway")
    .option("--keystore <kind>", "Keystore source: auto, file, or env", "auto")
    .action(async (opts: InboxCliOpts) => {
      try {
        const paths = resolvePaths();
        const config = await readConfig(paths.configFile);
        const ks = selectKeystore({ walletFile: paths.walletFile, override: opts.keystore });
        const privateKey = await ks.read();
        if (!privateKey) throw new Error("no key loaded. run `heed setup` first or set HEED_PRIVATE_KEY.");

        const rpcUrl = opts.rpcUrl ?? config.network.rpc_url;
        const gateway = opts.gateway ?? config.network.gateway;
        if (!rpcUrl) throw new Error("no RPC URL configured. set network.rpc_url or pass --rpc-url.");

        const keys = await deriveAgentKeys({
          privateKey,
          chainId: config.network.chain_id,
          contract: config.network.contract,
          keyNonce: config.key_nonce,
        });
        const walletAddress: Address = privateKeyToAccount(privateKey).address;

        const source = buildMailSource({
          rpcUrl,
          chainId: config.network.chain_id,
          contract: config.network.contract,
          deployedAtBlock: BigInt(config.network.deployed_at_block),
        });

        const deps = {
          walletAddress,
          encryptionKeyNonce: config.key_nonce,
          encryptionPriv: keys.encryptionPriv,
          chainId: config.network.chain_id,
          verifyingContract: config.network.contract,
          listInbox: (sinceBlock?: bigint, limit?: number) => source.listInbox(walletAddress, sinceBlock, limit),
          watchInbox: (handler: Parameters<typeof source.subscribe>[1]) => source.subscribe(walletAddress, handler),
          fetchByContentRef: (contentRef: `0x${string}`) => fetchByContentRef({ gateway, contentRef }),
        };

        const messages = await runInboxList(
          {
            ...(opts.sinceBlock !== undefined && { sinceBlock: BigInt(opts.sinceBlock) }),
            ...(opts.limit !== undefined && { limit: parseInt(opts.limit, 10) }),
          },
          deps,
        );

        for (const msg of messages) renderMessage(msg, opts.json === true);

        if (opts.watch) {
          const stop = watchInbox(deps, (msg) => renderMessage(msg, opts.json === true));
          process.stderr.write("watching for new messages (ctrl-c to exit)\n");
          await new Promise<void>((resolve) => {
            const onSig = () => {
              stop();
              resolve();
            };
            process.once("SIGINT", onSig);
            process.once("SIGTERM", onSig);
          });
        }
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });
}

export function renderMessage(msg: InboxMessage, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(serializeForJson(msg)));
    return;
  }
  console.log(formatText(msg));
}

function formatText(msg: InboxMessage): string {
  const ts = new Date(msg.blockTimestamp * 1000).toISOString().replace("T", " ").slice(0, 19);
  const senderLabel = `${msg.sender.slice(0, 6)}…${msg.sender.slice(-4)}`;
  if (msg.decodeError) {
    return `[${ts}] ${senderLabel} <decode failed: ${msg.decodeError}>`;
  }
  if (msg.decoded.kind === "envelope") {
    const env = msg.decoded.envelope;
    const fromLabel = env.from.name
      ? `${env.from.name}${env.from.owner_url ? ` · ${env.from.owner_url}` : ""}`
      : senderLabel;
    const verify = msg.signerMatchesSender ? "" : " ⚠ signer mismatch";
    const action = env.action_url ? `\n  → ${env.action_url}` : "";
    const reply = env.reply_to ? ` (reply to ${env.reply_to.slice(0, 10)}…)` : "";
    const uri = env.from.uri ? `\n  uri: ${env.from.uri}` : "";
    return `[${ts}] ${fromLabel}${verify}${reply}\n  ${env.title} [${env.urgency}]${uri}\n\n  ${env.body}${action}\n`;
  }
  if (msg.decoded.kind === "mail") {
    return `[${ts}] ${senderLabel} (legacy mail): ${msg.decoded.mail.subject}\n  ${msg.decoded.mail.body.text}\n`;
  }
  return `[${ts}] ${senderLabel} <unknown payload, ${msg.decoded.bytes.length} bytes>`;
}

function serializeForJson(msg: InboxMessage): unknown {
  const decoded =
    msg.decoded.kind === "unknown"
      ? { kind: "unknown" as const, bytes_length: msg.decoded.bytes.length }
      : msg.decoded;
  return {
    txHash: msg.txHash,
    blockNumber: msg.blockNumber.toString(),
    blockTimestamp: msg.blockTimestamp,
    sender: msg.sender,
    recipient: msg.recipient,
    contentRef: msg.contentRef,
    valueGwei: msg.valueGwei,
    decoded,
    ...(msg.signatureValid !== undefined && { signatureValid: msg.signatureValid }),
    ...(msg.signerMatchesSender !== undefined && { signerMatchesSender: msg.signerMatchesSender }),
    ...(msg.decodeError !== undefined && { decodeError: msg.decodeError }),
  };
}
