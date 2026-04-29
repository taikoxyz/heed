import { strict as assert } from "node:assert";
import { setTimeout as sleep } from "node:timers/promises";
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  defineChain,
  hexToBytes,
  http,
  parseGwei,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  KEY_TYPED_DATA,
  cidToDigest,
  createReadClient,
  createRpcMailSource,
  createWriteClient,
  decodeEncryptedBytes,
  decodePayload,
  deriveX25519Private,
  deriveX25519Public,
  digestToCid,
  encodeEncryptedBytes,
  encodeEnvelope,
  recoverEnvelopeSigner,
  signEnvelope,
  type Envelope,
  type UnsignedEnvelope,
} from "@heed/core";
import { startIpfsStub } from "./ipfs-stub";

const RPC_URL = required("RPC_URL");
const CONTRACT = required("HEED_ADDRESS") as Address;
const DEPLOYED_AT_BLOCK = BigInt(required("DEPLOYED_AT_BLOCK"));
const CHAIN_ID = Number(required("CHAIN_ID"));

const ALICE_PK = required("ALICE_PK") as Hex;
const BOB_PK = required("BOB_PK") as Hex;

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`missing required env var: ${name}`);
  }
  return v;
}

const chain = defineChain({
  id: CHAIN_ID,
  name: `e2e-${CHAIN_ID}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

async function deriveX25519FromWallet(privateKey: Hex, keyNonce: number) {
  const account = privateKeyToAccount(privateKey);
  const sig = await account.signTypedData({
    domain: KEY_TYPED_DATA.domain(CHAIN_ID, CONTRACT),
    types: KEY_TYPED_DATA.types,
    primaryType: KEY_TYPED_DATA.primaryType,
    message: KEY_TYPED_DATA.message(keyNonce),
  });
  const sk = deriveX25519Private(hexToBytes(sig));
  const pk = deriveX25519Public(sk);
  return { address: account.address, sk, pk };
}

async function publishKey(privateKey: Hex, keyNonce: number, pub: Hex) {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, transport: http(RPC_URL), chain });
  const write = createWriteClient(wallet, CONTRACT);
  return await write.publishKey(keyNonce, pub);
}

async function setFee(privateKey: Hex, valueGwei: number) {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, transport: http(RPC_URL), chain });
  const write = createWriteClient(wallet, CONTRACT);
  return await write.setFee(valueGwei);
}

async function buildSignedEnvelope(
  privateKey: Hex,
  unsigned: UnsignedEnvelope,
): Promise<Envelope> {
  const account = privateKeyToAccount(privateKey);
  return await signEnvelope({
    envelope: unsigned,
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT,
    signer: (typedData) => account.signTypedData(typedData),
  });
}

async function sendOnChain(args: {
  privateKey: Hex;
  recipient: Address;
  contentRef: Hex;
  valueGwei: number;
}) {
  const account = privateKeyToAccount(args.privateKey);
  const wallet = createWalletClient({ account, transport: http(RPC_URL), chain });
  const write = createWriteClient(wallet, CONTRACT);
  return await write.sendBatch(
    [{ recipient: args.recipient, valueGwei: args.valueGwei, contentRef: args.contentRef }],
    true,
    parseGwei(args.valueGwei.toString()),
  );
}

async function main() {
  const stub = await startIpfsStub();
  let exitCode = 0;
  try {
    log(`ipfs stub: ${stub.url}`);

    const publicClient = createPublicClient({ transport: http(RPC_URL), chain });
    const reader = createReadClient(publicClient, CONTRACT);
    const source = createRpcMailSource({
      client: publicClient,
      contract: CONTRACT,
      deployedAtBlock: DEPLOYED_AT_BLOCK,
    });

    log("deriving x25519 keypairs for alice + bob...");
    const alice = await deriveX25519FromWallet(ALICE_PK, 0);
    const bob = await deriveX25519FromWallet(BOB_PK, 0);
    log(`alice: ${alice.address}`);
    log(`bob:   ${bob.address}`);

    log("publishing both encryption keys + setting bob's fee to 100 gwei...");
    await publishKey(ALICE_PK, 0, bytesToHex(alice.pk));
    await publishKey(BOB_PK, 0, bytesToHex(bob.pk));
    await setFee(BOB_PK, 100);

    const bobInbox = await reader.getInbox(bob.address);
    assert.equal(bobInbox.feeGwei, 100, "bob feeGwei");
    assert.notEqual(bobInbox.keys[0].pub, "0x" + "00".repeat(64), "bob key published");

    log("alice composes + signs envelope to bob...");
    const unsigned: UnsignedEnvelope = {
      v: 1,
      kind: "agent",
      from: {
        name: "ACME Alerts",
        owner_url: "https://acme.example",
        uri: "https://acme.example/agents/alerts",
      },
      title: "deploy succeeded",
      body: "build #1234 is live",
      urgency: "normal",
      action_url: "https://acme.example/releases/1234",
      sent_at: Math.floor(Date.now() / 1000),
    };
    const signed = await buildSignedEnvelope(ALICE_PK, unsigned);

    log("encrypting envelope with bob's pub and pinning to ipfs stub...");
    const envelopeBytes = encodeEnvelope(signed);
    const encrypted = encodeEncryptedBytes(envelopeBytes, [
      { rcpt: bob.address, keyNonce: 0, pub: bob.pk },
    ]);
    const cid = stub.pin(encrypted);
    const contentRef = bytesToHex(cidToDigest(cid));

    log(`alice sends on-chain (cid=${cid.slice(0, 12)}...)`);
    const txHash = await sendOnChain({
      privateKey: ALICE_PK,
      recipient: bob.address,
      contentRef,
      valueGwei: 100,
    });
    log(`tx: ${txHash}`);

    log("polling bob's inbox via mail source...");
    const inbox = await pollUntil(async () => {
      const items = await source.listInbox(bob.address, DEPLOYED_AT_BLOCK, 50);
      return items.length > 0 ? items : null;
    }, 5000);
    assert.equal(inbox.length, 1, "bob has exactly one message");
    const msg = inbox[0]!;
    assert.equal(msg.sender.toLowerCase(), alice.address.toLowerCase(), "sender = alice");
    assert.equal(msg.contentRef.toLowerCase(), contentRef.toLowerCase(), "contentRef matches");
    assert.equal(msg.valueGwei, 100, "valueGwei matches fee");

    log("fetching from ipfs stub + decrypting...");
    const fetched = await fetch(`${stub.url}/ipfs/${cid}`);
    assert.equal(fetched.ok, true, "gateway returned 200");
    const fetchedBytes = new Uint8Array(await fetched.arrayBuffer());

    const decryptedEnvelopeBytes = decodeEncryptedBytes(fetchedBytes, {
      rcpt: bob.address,
      keyNonce: 0,
      sk: bob.sk,
    });
    const decoded = decodePayload(decryptedEnvelopeBytes);
    assert.equal(decoded.kind, "envelope", "decoded as envelope");
    if (decoded.kind !== "envelope") throw new Error("unreachable");
    const env = decoded.envelope;

    assert.equal(env.title, signed.title, "title round-trips");
    assert.equal(env.body, signed.body, "body round-trips");
    assert.equal(env.urgency, signed.urgency, "urgency round-trips");
    assert.equal(env.action_url, signed.action_url, "action_url round-trips");
    assert.equal(env.from.name, signed.from.name, "from.name round-trips");
    assert.equal(env.from.owner_url, signed.from.owner_url, "owner_url round-trips");
    assert.equal(env.from.uri, signed.from.uri, "uri round-trips");

    log("verifying envelope signature recovers to alice...");
    const recovered = await recoverEnvelopeSigner({
      envelope: env,
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    });
    assert.equal(recovered.toLowerCase(), alice.address.toLowerCase(), "signer = alice");

    log("e2e: PASS");
  } catch (err) {
    process.stderr.write(`e2e: FAIL — ${(err as Error).stack ?? (err as Error).message}\n`);
    exitCode = 1;
  } finally {
    await stub.close();
  }
  process.exit(exitCode);
}

async function pollUntil<T>(fn: () => Promise<T | null>, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v !== null) return v;
    await sleep(150);
  }
  throw new Error(`pollUntil: timed out after ${timeoutMs}ms`);
}

function log(msg: string): void {
  process.stderr.write(`[e2e] ${msg}\n`);
}

main();
