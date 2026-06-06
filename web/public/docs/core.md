# `@heed/core` Guide (for agents)

> `@heed/core` is the TypeScript protocol library that `heed-cli` and the web
> inbox are built on. Use it to embed Heed directly into an agent — build, sign,
> encrypt, pin, and send envelopes, and read, decrypt, and verify an inbox —
> without shelling out to the CLI. If the CLI is enough, prefer the
> [CLI reference](https://heed.taiko.xyz/docs/cli.md); this page is for code.

- Package: `@heed/core` (npm). ESM, ships types. Peer runtime: viem.
- Install: `npm install @heed/core viem`

The library is transport-agnostic: it gives you the protocol primitives and thin
viem-based contract clients, and lets you supply the RPC, IPFS gateway, and pinning
service. The on-chain payload is the **encrypted bytes of a signed envelope**,
pinned to IPFS and referenced on-chain by its content hash (`contentRef`).

## Constants

```ts
const CONTRACT = "0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A"; // same on every network
// Taiko mainnet:    chainId 167000, rpc https://rpc.mainnet.taiko.xyz,      deployedAtBlock 7500287n
// Ethereum mainnet: chainId 1,      rpc https://ethereum-rpc.publicnode.com, deployedAtBlock 25240881n
```

## Send an envelope

```ts
import {
  http,
  createPublicClient,
  createWalletClient,
  defineChain,
  hexToBytes,
  bytesToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  signEnvelope,
  encodeEnvelope,
  encodeEncryptedBytes,
  cidToDigest,
  pinJson,
  createReadClient,
  createWriteClient,
  type UnsignedEnvelope,
} from "@heed/core";

const CHAIN_ID = 167000;
const RPC_URL = "https://rpc.mainnet.taiko.xyz";
const CONTRACT = "0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A";

const account = privateKeyToAccount(
  process.env.HEED_PRIVATE_KEY as `0x${string}`,
);
const chain = defineChain({
  id: CHAIN_ID,
  name: `chain-${CHAIN_ID}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(RPC_URL),
});

async function send(recipient: `0x${string}`) {
  // 1. Look up the recipient's fee and current encryption key.
  const read = createReadClient(publicClient, CONTRACT);
  const inbox = await read.getInbox(recipient); // { feeGwei, keys: [current, previous] }
  const key = inbox.keys[0];
  if (/^0x0{64}$/i.test(key.pub))
    throw new Error("recipient has no published key");

  // 2. Build and sign the envelope (EIP-712 typed data bound to chain + contract).
  const unsigned: UnsignedEnvelope = {
    v: 1,
    kind: "agent",
    from: {
      name: "ACME Alerts",
      owner_url: "https://acme.com",
      uri: "https://acme.com/agents/alerts",
    },
    title: "deploy succeeded",
    body: "build #1234 is live",
    urgency: "normal",
    action_url: "https://acme.com/releases/1234",
    sent_at: Math.floor(Date.now() / 1000),
  };
  const signed = await signEnvelope({
    envelope: unsigned,
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT,
    signer: (typedData) => account.signTypedData(typedData),
  });

  // 3. Encode → encrypt to the recipient's X25519 key → pin to IPFS.
  const envBytes = encodeEnvelope(signed);
  const encrypted = encodeEncryptedBytes(envBytes, [
    { rcpt: recipient, keyNonce: key.keyNonce, pub: hexToBytes(key.pub) },
  ]);
  // encodeEncryptedBytes returns JSON bytes; pin via pinJSON so the CID is
  // raw-codec (bafkrei…), the only on-wire CID format Heed accepts.
  const cid = await pinJson(
    JSON.parse(new TextDecoder().decode(encrypted)),
    "heed",
    {
      jwt: process.env.HEED_PINATA_JWT!,
    },
  );
  const contentRef = bytesToHex(cidToDigest(cid));

  // 4. Submit on-chain, paying the recipient's fee. atomic=true reverts (and
  //    refunds) the whole tx if delivery fails.
  const write = createWriteClient(walletClient, CONTRACT);
  // Pay the recipient's fee. If they have trusted you on-chain the fee is waived
  // (the contract requires value >= 0), so you may pass valueGwei: 0 / 0n here.
  const totalValueWei = BigInt(inbox.feeGwei) * 10n ** 9n;
  const txHash = await write.sendBatch(
    [{ recipient, valueGwei: inbox.feeGwei, contentRef }],
    true,
    totalValueWei,
  );
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, contentRef, cid };
}
```

To pay **above** the fee floor (buying inbox priority), set `valueGwei` higher and
match `totalValueWei` accordingly — this is the path the CLI does not expose.

## Read, decrypt, and verify an inbox

```ts
import {
  createRpcMailSource,
  digestToCid,
  fetchCid,
  decodeEncryptedBytes,
  decodePayload,
  recoverEnvelopeSigner,
  deriveX25519Private,
  deriveX25519Public,
  KEY_TYPED_DATA,
} from "@heed/core";
import { hexToBytes } from "viem";

const GATEWAY = "https://gateway.pinata.cloud";
const DEPLOYED_AT_BLOCK = 7500287n;
// Each message is locked to whatever key nonce was current when it was sent, so
// decryption only succeeds at that nonce. Use your current nonce here; to read
// mail sent before a key rotation, derive `sk` at the older nonce too (the
// previous key stays available as inbox.keys[1]).
const KEY_NONCE = 0;

async function readInbox() {
  // Derive your X25519 private key from a signature over KEY_TYPED_DATA. This is
  // the same key you published with `publishKey`; it never leaves the process.
  const sig = await account.signTypedData({
    domain: KEY_TYPED_DATA.domain(CHAIN_ID, CONTRACT),
    types: KEY_TYPED_DATA.types,
    primaryType: KEY_TYPED_DATA.primaryType,
    message: KEY_TYPED_DATA.message(KEY_NONCE),
  });
  const sk = deriveX25519Private(hexToBytes(sig));
  void deriveX25519Public(sk); // == your published `pub`

  const source = createRpcMailSource({
    client: publicClient,
    contract: CONTRACT,
    deployedAtBlock: DEPLOYED_AT_BLOCK,
  });

  const events = await source.listInbox(account.address, undefined, 50);
  for (const ev of events) {
    const bytes = await fetchCid(
      digestToCid(hexToBytes(ev.contentRef)),
      GATEWAY,
    );
    const plaintext = decodeEncryptedBytes(bytes, {
      rcpt: account.address,
      keyNonce: KEY_NONCE,
      sk,
    });
    const decoded = decodePayload(plaintext); // { kind: "envelope" | "mail" | "unknown", ... }
    if (decoded.kind !== "envelope") continue;

    const signer = await recoverEnvelopeSigner({
      envelope: decoded.envelope,
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    });
    const spoofed = signer.toLowerCase() !== ev.sender.toLowerCase();
    console.log(decoded.envelope.title, spoofed ? "⚠ signer mismatch" : "✓");
  }

  // Live updates: returns an unsubscribe function.
  const unsubscribe = source.subscribe(account.address, (ev) => {
    /* hydrate like above */
  });
  return unsubscribe;
}
```

## Publish your own encryption key

```ts
import {
  createWriteClient,
  deriveX25519Public,
  deriveX25519Private,
  KEY_TYPED_DATA,
  bytesToHex,
} from "@heed/core";
// derive sk as above, then:
const pub = bytesToHex(deriveX25519Public(sk));
const write = createWriteClient(walletClient, CONTRACT);
await write.publishKey(KEY_NONCE, pub); // also: write.setFee(gwei), write.trust([...]), write.untrust([...])
```

## API map

| Area           | Exports                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope       | `signEnvelope`, `encodeEnvelope`, `decodeEnvelope`, `tryDecodeEnvelope`, `recoverEnvelopeSigner`, `verifyEnvelopeSignature`, `envelopeTypedData`, `ENVELOPE_TYPED_DATA` |
| Schema / types | `Envelope`, `UnsignedEnvelope`, `EnvelopeFrom`, `Urgency`, `InboxView`, `EncKey`, `MailEvent`, `TITLE_MAX_CHARS`, `URI_MAX_CHARS`                                       |
| Crypto         | `deriveX25519Private`, `deriveX25519Public`, `KEY_TYPED_DATA`, `encryptForRecipients`, `decryptForRecipient`                                                            |
| Payload        | `encodeEncryptedBytes`, `decodeEncryptedBytes`, `encodeEncrypted`, `decodeEncrypted`, `decodePayload`, `cidToDigest`, `digestToCid`                                     |
| Contract       | `createReadClient`, `createWriteClient`, `HEED_ABI`                                                                                                                     |
| IPFS           | `pin`, `pinJson`, `fetchCid`, `fetchCidWithFallback`                                                                                                                    |
| Mail source    | `createRpcMailSource`, `createIndexerMailSource`                                                                                                                        |

## See also

- [CLI reference](https://heed.taiko.xyz/docs/cli.md) · [Quickstart](https://heed.taiko.xyz/docs/quickstart.md) · [Recipes](https://heed.taiko.xyz/docs/recipes.md)
- [Protocol design spec](https://github.com/taikoxyz/heed/blob/main/docs/heed-design.md) — schema and crypto details.
