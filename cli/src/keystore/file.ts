import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import type { Hex } from "viem";
import { assertPrivateKey, type Keystore } from "./types";

export function fileKeystore(walletFile: string): Keystore {
  return {
    source: "file",
    async read() {
      try {
        const raw = await readFile(walletFile, "utf8");
        const parsed = JSON.parse(raw) as { privateKey?: string };
        if (!parsed.privateKey) return null;
        return assertPrivateKey(parsed.privateKey);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async write(privateKey: Hex) {
      assertPrivateKey(privateKey);
      await mkdir(dirname(walletFile), { recursive: true, mode: 0o700 });
      await writeFile(walletFile, JSON.stringify({ privateKey }, null, 2) + "\n", { mode: 0o600 });
    },
    async remove() {
      try {
        await unlink(walletFile);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    },
  };
}
