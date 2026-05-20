import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  IPFS_PORT,
  RPC_PORT,
  buildFixtures,
  startIpfsGateway,
  startMockRpc,
} from "./harness";
import { buildWalletStubData } from "./wallet-stub";

export const STATE_FILE = join(tmpdir(), "heed-e2e-state.json");

async function globalSetup() {
  const ipfs = await startIpfsGateway(IPFS_PORT);
  const fixtures = await buildFixtures(ipfs.pin);
  const rpc = await startMockRpc(RPC_PORT, fixtures);
  const wallet = await buildWalletStubData();

  writeFileSync(
    STATE_FILE,
    JSON.stringify({
      recipient: fixtures.recipient,
      sender: fixtures.sender,
      matchTitle: fixtures.matchTitle,
      matchBody: fixtures.matchBody,
      matchActionUrl: fixtures.matchActionUrl,
      mismatchTitle: fixtures.mismatchTitle,
      mismatchBody: fixtures.mismatchBody,
      wallet,
    }),
  );

  (globalThis as Record<string, unknown>).__heedE2eClose = async () => {
    await rpc.close();
    await ipfs.close();
  };
}

export default globalSetup;
