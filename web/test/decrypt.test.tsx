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
  deriveX25519Private,
  deriveX25519Public,
  type PlaintextPayload,
} from "@heed/core";
import { clearKeys } from "../src/lib/keys";

const SIG_HEX =
  "0xabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab";
const PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const account = privateKeyToAccount(PRIVATE_KEY);

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

const ENVELOPE_BYTES = encodeEncrypted(PAYLOAD, [
  { rcpt: account.address, keyNonce: 0, pub },
]);

vi.mock("@heed/core", async () => {
  const actual = await vi.importActual<typeof import("@heed/core")>(
    "@heed/core",
  );
  return {
    ...actual,
    fetchCid: vi.fn(async () => ENVELOPE_BYTES),
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
  beforeEach(() => {
    clearKeys();
  });

  it("decrypts an envelope addressed to the connected wallet", async () => {
    const { connect } = await import("@wagmi/core");
    await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

    const { useMailDecryption } = await import(
      "../src/hooks/useMailDecryption"
    );
    const { result } = renderHook(() => useMailDecryption(), { wrapper });

    let decrypted: PlaintextPayload | undefined;
    await act(async () => {
      decrypted = await result.current(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
    });

    expect(decrypted).toEqual(PAYLOAD);
  });
});
