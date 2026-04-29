import type { Hex } from "viem";
import { assertPrivateKey, KeystoreReadOnlyError, type Keystore } from "./types";

export function envKeystore(env: NodeJS.ProcessEnv = process.env): Keystore {
  return {
    source: "env",
    async read() {
      const value = env.HEED_PRIVATE_KEY;
      if (!value || value.length === 0) return null;
      return assertPrivateKey(value);
    },
    async write(_privateKey: Hex) {
      throw new KeystoreReadOnlyError("env");
    },
    async remove() {
      throw new KeystoreReadOnlyError("env");
    },
  };
}
