import { envKeystore } from "./env";
import { fileKeystore } from "./file";
import type { Keystore } from "./types";

export type KeystoreOverride = "auto" | "file" | "env";

export function selectKeystore(args: {
  walletFile: string;
  override: KeystoreOverride;
  env?: NodeJS.ProcessEnv;
}): Keystore {
  const env = args.env ?? process.env;
  if (args.override === "env") return envKeystore(env);
  if (args.override === "file") return fileKeystore(args.walletFile);
  if (env.HEED_PRIVATE_KEY && env.HEED_PRIVATE_KEY.length > 0) return envKeystore(env);
  return fileKeystore(args.walletFile);
}

export * from "./types";
export { envKeystore } from "./env";
export { fileKeystore } from "./file";
