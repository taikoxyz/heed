// Machine-readable error reporting for the Heed CLI.
//
// Agents drive `heed` programmatically. Every failure must surface a stable
// `code` string and a stable exit code so the agent can branch on them
// without substring-matching English prose.
//
// Exit-code taxonomy (stable wire contract):
//   1 UNKNOWN              — fallback, unclassified failure
//   2 BAD_INPUT            — malformed args, missing config, missing env
//   3 INSUFFICIENT_FUNDS   — wallet can't cover gas + value
//   4 RECIPIENT_NO_KEY     — recipient hasn't published an encryption key
//   5 FEE_EXCEEDS_MAX      — recipient's fee exceeds caller's --max-fee-gwei
//   6 NETWORK              — RPC / HTTP / IPFS gateway transport failure
//   7 DELIVERY_FAILED      — receipt observed but tx reverted (atomic + wait)

export type ErrorCode =
  | "BAD_INPUT"
  | "PINATA_JWT_MISSING"
  | "WALLET_NOT_CONFIGURED"
  | "RPC_NOT_CONFIGURED"
  | "RECIPIENT_NO_KEY"
  | "FEE_EXCEEDS_MAX"
  | "INSUFFICIENT_FUNDS"
  | "DELIVERY_FAILED"
  | "NETWORK"
  | "UNKNOWN";

const EXIT_CODES: Record<ErrorCode, number> = {
  BAD_INPUT: 2,
  PINATA_JWT_MISSING: 2,
  WALLET_NOT_CONFIGURED: 2,
  RPC_NOT_CONFIGURED: 2,
  INSUFFICIENT_FUNDS: 3,
  RECIPIENT_NO_KEY: 4,
  FEE_EXCEEDS_MAX: 5,
  NETWORK: 6,
  DELIVERY_FAILED: 7,
  UNKNOWN: 1,
};

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
  get exitCode(): number {
    return EXIT_CODES[this.code];
  }
}

export function reportError(err: unknown): void {
  const cli = toCliError(err);
  const payload: {
    error: {
      code: ErrorCode;
      message: string;
      details?: Record<string, unknown>;
    };
  } = { error: { code: cli.code, message: cli.message } };
  if (cli.details) payload.error.details = cli.details;
  process.stderr.write(JSON.stringify(payload) + "\n");
  process.exitCode = cli.exitCode;
}

// Best-effort classifier for raw exceptions thrown from deps (viem, fetch,
// fs, etc.). Anything we can't pattern-match is UNKNOWN so the agent always
// gets a typed code instead of a bare string.
function toCliError(err: unknown): CliError {
  if (err instanceof CliError) return err;
  const e = err as { name?: string; shortMessage?: string; message?: string };
  const name = e?.name ?? "";
  const message = e?.shortMessage ?? e?.message ?? String(err);
  if (/insufficient funds/i.test(message)) {
    return new CliError("INSUFFICIENT_FUNDS", message);
  }
  if (
    name.includes("HttpRequestError") ||
    name.includes("RpcRequestError") ||
    name.includes("TimeoutError") ||
    /HTTP request failed|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection (refused|reset)/i.test(
      message,
    )
  ) {
    return new CliError("NETWORK", message);
  }
  return new CliError("UNKNOWN", message);
}

// JSON.stringify replacer that converts bigints to decimal strings so the
// CLI can print receipt fields (blockNumber, gasUsed, totalCostWei) safely.
export function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
