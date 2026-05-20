import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, createConfig } from "wagmi";
import { taiko } from "wagmi/chains";
import { mock } from "wagmi/connectors";
import { privateKeyToAccount } from "viem/accounts";
import {
  encodeEncrypted,
  encodeEncryptedBytes,
  encodeEnvelope,
  signEnvelope,
  deriveX25519Private,
  deriveX25519Public,
  type DecodedPayload,
  type Envelope,
  type PlaintextPayload,
} from "@heed/core";
import { clearKeys } from "../src/lib/keys";

const SIG_HEX =
  "0xabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab";
const PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const SENDER_PK =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

const account = privateKeyToAccount(PRIVATE_KEY);
const senderAccount = privateKeyToAccount(SENDER_PK);

const sigBytes = new Uint8Array(
  SIG_HEX.slice(2).match(/.{2}/g)!.map((b) => parseInt(b, 16)),
);
const sk = deriveX25519Private(sigBytes);
const pub = deriveX25519Public(sk);

const PAYLOAD: PlaintextPayload = {
  v: 1,
  kind: "mail",
  from: "0x0000000000000000000000000000000000000001",
  to: [account.address],
  cc: [],
  date: 1714000000,
  msgId: "msg-1",
  subject: "hello world",
  body: { text: "this is encrypted" },
  attachments: [],
};

const MAIL_BYTES = encodeEncrypted(PAYLOAD, [
  { rcpt: account.address, keyNonce: 0, pub },
]);

let envelopeBytes: Uint8Array;
let signedEnvelope: Envelope;

const fetchedRef: { current: Uint8Array | null } = { current: MAIL_BYTES };

vi.mock("@heed/core", async () => {
  const actual = await vi.importActual<typeof import("@heed/core")>(
    "@heed/core",
  );
  return {
    ...actual,
    fetchCid: vi.fn(async () => fetchedRef.current ?? new Uint8Array()),
    fetchCidWithFallback: vi.fn(async () => fetchedRef.current ?? new Uint8Array()),
  };
});

vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");
  return {
    ...actual,
    useSignTypedData: () => ({
      signTypedDataAsync: vi.fn(async () => SIG_HEX),
    }),
  };
});

const wagmiConfig = createConfig({
  chains: [taiko],
  transports: { [taiko.id]: http() },
  connectors: [mock({ accounts: [account.address] })],
});

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

describe("useMailDecryption", () => {
  beforeEach(async () => {
    clearKeys();
    fetchedRef.current = MAIL_BYTES;
    signedEnvelope = await signEnvelope({
      envelope: {
        v: 1,
        kind: "agent",
        from: { name: "Test Bot", owner_url: "https://example.test" },
        title: "ping",
        body: "hello",
        urgency: "normal",
        sent_at: 1735689600,
      },
      chainId: taiko.id,
      verifyingContract: "0x0000000000000000000000000000000000000abc",
      signer: async (typedData) => senderAccount.signTypedData(typedData),
    });
    envelopeBytes = encodeEncryptedBytes(encodeEnvelope(signedEnvelope), [
      { rcpt: account.address, keyNonce: 0, pub },
    ]);
  });

  it("decrypts a legacy mail payload to kind=mail", async () => {
    const { connect } = await import("@wagmi/core");
    await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

    const { useMailDecryption } = await import("../src/hooks/useMailDecryption");
    const { result } = renderHook(() => useMailDecryption(), { wrapper });

    let decoded: DecodedPayload | undefined;
    await act(async () => {
      decoded = await result.current(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
    });

    expect(decoded?.kind).toBe("mail");
    if (decoded?.kind === "mail") expect(decoded.mail).toEqual(PAYLOAD);
  });

  it("decrypts an agent envelope to kind=envelope", async () => {
    const { connect } = await import("@wagmi/core");
    await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

    fetchedRef.current = envelopeBytes;

    const { useMailDecryption } = await import("../src/hooks/useMailDecryption");
    const { result } = renderHook(() => useMailDecryption(), { wrapper });

    let decoded: DecodedPayload | undefined;
    await act(async () => {
      decoded = await result.current(
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      );
    });

    expect(decoded?.kind).toBe("envelope");
    if (decoded?.kind === "envelope") expect(decoded.envelope).toEqual(signedEnvelope);
  });

  it("returns kind=unknown for non-payload bytes", async () => {
    const { connect } = await import("@wagmi/core");
    await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

    fetchedRef.current = encodeEncryptedBytes(
      new TextEncoder().encode("not a heed payload"),
      [{ rcpt: account.address, keyNonce: 0, pub }],
    );

    const { useMailDecryption } = await import("../src/hooks/useMailDecryption");
    const { result } = renderHook(() => useMailDecryption(), { wrapper });

    let decoded: DecodedPayload | undefined;
    await act(async () => {
      decoded = await result.current(
        "0x0000000000000000000000000000000000000000000000000000000000000003",
      );
    });

    expect(decoded?.kind).toBe("unknown");
  });
});
