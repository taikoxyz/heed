import type { Hex } from "viem";

export type KeystoreSource = "file" | "env";

export interface Keystore {
  source: KeystoreSource;
  read(): Promise<Hex | null>;
  write(privateKey: Hex): Promise<void>;
  remove(): Promise<void>;
}

export class KeystoreReadOnlyError extends Error {
  constructor(source: KeystoreSource) {
    super(`keystore source "${source}" is read-only; unset HEED_PRIVATE_KEY to manage keys with --keystore=file`);
    this.name = "KeystoreReadOnlyError";
  }
}

export const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function assertPrivateKey(value: string): Hex {
  if (!PRIVATE_KEY_PATTERN.test(value)) {
    throw new Error("private key must be 0x followed by 64 hex chars");
  }
  return value as Hex;
}
