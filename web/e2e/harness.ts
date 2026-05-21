import { createServer, type Server } from "node:http";
import {
  bytesToHex,
  encodeAbiParameters,
  hexToBytes,
  keccak256,
  pad,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  cidToDigest,
  deriveX25519Private,
  deriveX25519Public,
  encodeEncryptedBytes,
  encodeEnvelope,
  KEY_TYPED_DATA,
  signEnvelope,
  type UnsignedEnvelope,
} from "@heed/core";
import { startIpfsStub, type IpfsStub } from "../../scripts/e2e/ipfs-stub";

export const CHAIN_ID = 167_000;
export const CONTRACT = "0x00000000000000000000000000000000000000ee" as Address;
export const DEPLOYED_AT_BLOCK = 100n;
export const SEEDED_BLOCK = 120n;
export const SEEDED_BLOCK_TS = 1_700_000_000n;

export const RPC_PORT = 8645;
export const IPFS_PORT = 8646;
export const RPC_URL = `http://127.0.0.1:${RPC_PORT}`;
export const IPFS_URL = `http://127.0.0.1:${IPFS_PORT}`;

export const RECIPIENT_PK =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
export const SENDER_PK =
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as Hex;
export const OTHER_PK =
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as Hex;

const MAIL_SENT_TOPIC = keccak256(
  toHex("MailSent(address,address,bytes32,uint32)"),
);

interface SeedLog {
  contentRef: Hex;
  sender: Address;
}

export interface Fixtures {
  recipient: Address;
  sender: Address;
  matchTitle: string;
  matchBody: string;
  matchActionUrl: string;
  mismatchTitle: string;
  mismatchBody: string;
  logs: SeedLog[];
}

async function deriveX25519(pk: Hex) {
  const account = privateKeyToAccount(pk);
  const sig = await account.signTypedData({
    domain: KEY_TYPED_DATA.domain(CHAIN_ID, CONTRACT),
    types: KEY_TYPED_DATA.types,
    primaryType: KEY_TYPED_DATA.primaryType,
    message: KEY_TYPED_DATA.message(0),
  });
  const sk = deriveX25519Private(hexToBytes(sig));
  return { address: account.address, sk, pub: deriveX25519Public(sk) };
}

async function buildMessage(args: {
  signWithPk: Hex;
  senderAddress: Address;
  recipient: Address;
  recipientPub: Uint8Array;
  envelope: UnsignedEnvelope;
  pin: (bytes: Uint8Array) => string;
}): Promise<SeedLog> {
  const signerAccount = privateKeyToAccount(args.signWithPk);
  const signed = await signEnvelope({
    envelope: args.envelope,
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT,
    signer: (typedData) => signerAccount.signTypedData(typedData),
  });
  const encrypted = encodeEncryptedBytes(encodeEnvelope(signed), [
    { rcpt: args.recipient, keyNonce: 0, pub: args.recipientPub },
  ]);
  const cid = args.pin(encrypted);
  return {
    contentRef: bytesToHex(cidToDigest(cid)),
    sender: args.senderAddress,
  };
}

export async function buildFixtures(
  pin: (bytes: Uint8Array) => string,
): Promise<Fixtures> {
  const recipient = await deriveX25519(RECIPIENT_PK);
  const sender = privateKeyToAccount(SENDER_PK);

  const matchTitle = "deploy succeeded";
  const matchBody = "build #1234 is live on Taiko mainnet";
  const matchActionUrl = "https://acme.example/releases/1234";
  const mismatchTitle = "spoofed payout";
  const mismatchBody = "click here to claim your reward";

  const matchLog = await buildMessage({
    signWithPk: SENDER_PK,
    senderAddress: sender.address,
    recipient: recipient.address,
    recipientPub: recipient.pub,
    pin,
    envelope: {
      v: 1,
      kind: "agent",
      from: {
        name: "ACME Alerts",
        owner_url: "https://acme.example",
        uri: "https://acme.example/agents/alerts",
      },
      title: matchTitle,
      body: matchBody,
      urgency: "normal",
      action_url: matchActionUrl,
      sent_at: 1_700_000_000,
    },
  });

  // Signed by OTHER_PK but sent on-chain from SENDER, so recovered signer
  // will not match the on-chain sender -> mismatch badge.
  const mismatchLog = await buildMessage({
    signWithPk: OTHER_PK,
    senderAddress: sender.address,
    recipient: recipient.address,
    recipientPub: recipient.pub,
    pin,
    envelope: {
      v: 1,
      kind: "agent",
      from: {
        name: "Spoofer",
        owner_url: "https://evil.example",
      },
      title: mismatchTitle,
      body: mismatchBody,
      urgency: "high",
      sent_at: 1_700_000_500,
    },
  });

  return {
    recipient: recipient.address,
    sender: sender.address,
    matchTitle,
    matchBody,
    matchActionUrl,
    mismatchTitle,
    mismatchBody,
    logs: [matchLog, mismatchLog],
  };
}

function encodeLog(log: SeedLog, recipient: Address, index: number) {
  return {
    address: CONTRACT,
    topics: [MAIL_SENT_TOPIC, pad(log.sender), pad(recipient)],
    data: encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint32" }],
      [log.contentRef, 100],
    ),
    blockNumber: toHex(SEEDED_BLOCK),
    blockHash: pad(toHex(0xb10c)),
    transactionHash: pad(toHex(0x7a00 + index)),
    transactionIndex: toHex(index),
    logIndex: toHex(index),
    removed: false,
  };
}

export async function startMockRpc(
  port: number,
  fixtures: Fixtures,
): Promise<{ url: string; close: () => Promise<void> }> {
  const encodedLogs = fixtures.logs.map((l, i) =>
    encodeLog(l, fixtures.recipient, i),
  );

  function handle(method: string, params: unknown[]): unknown {
    switch (method) {
      case "eth_chainId":
        return toHex(CHAIN_ID);
      case "eth_blockNumber":
        return toHex(SEEDED_BLOCK);
      case "net_version":
        return String(CHAIN_ID);
      case "eth_getBlockByNumber":
        return {
          number: toHex(SEEDED_BLOCK),
          hash: pad(toHex(0xb10c)),
          timestamp: toHex(SEEDED_BLOCK_TS),
          parentHash: pad("0x00"),
          transactions: [],
        };
      case "eth_getLogs": {
        const filter = (params[0] ?? {}) as {
          topics?: (Hex | null)[];
          fromBlock?: Hex;
          toBlock?: Hex;
        };
        const recipientTopic = filter.topics?.[2];
        // The inbox filters by indexed recipient (topic[2]); only return
        // seeded logs that match (or when no recipient filter is given).
        if (
          recipientTopic &&
          recipientTopic.toLowerCase() !== pad(fixtures.recipient).toLowerCase()
        ) {
          return [];
        }
        // Honour the block window so the windowed scan behaves realistically.
        const from = filter.fromBlock ? BigInt(filter.fromBlock) : 0n;
        const to = filter.toBlock ? BigInt(filter.toBlock) : SEEDED_BLOCK;
        return SEEDED_BLOCK >= from && SEEDED_BLOCK <= to ? encodedLogs : [];
      }
      default:
        return null;
    }
  }

  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "POST, OPTIONS");
      res.setHeader("access-control-allow-headers", "*");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.end("bad json");
        return;
      }
      const batch = Array.isArray(parsed) ? parsed : [parsed];
      const out = batch.map((r) => {
        const { id, method, params } = r as {
          id: unknown;
          method: string;
          params?: unknown[];
        };
        return {
          jsonrpc: "2.0",
          id,
          result: handle(method, params ?? []),
        };
      });
      res.statusCode = 200;
      res.end(JSON.stringify(Array.isArray(parsed) ? out : out[0]));
    });
  });

  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${port}`;
  const close = () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  return { url, close };
}

// The shared IPFS stub has no CORS headers, so the browser cannot read it
// cross-origin. Wrap it with a thin CORS proxy bound to the fixed gateway port.
export async function startIpfsGateway(port: number): Promise<IpfsStub> {
  const stub = await startIpfsStub();

  const server: Server = createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    try {
      const upstream = await fetch(`${stub.url}${req.url}`);
      res.statusCode = upstream.status;
      res.setHeader(
        "content-type",
        upstream.headers.get("content-type") ?? "application/octet-stream",
      );
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.statusCode = 502;
      res.end("gateway proxy error");
    }
  });

  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );

  return {
    url: `http://127.0.0.1:${port}`,
    pin: stub.pin,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      await stub.close();
    },
  };
}

export type { IpfsStub };
