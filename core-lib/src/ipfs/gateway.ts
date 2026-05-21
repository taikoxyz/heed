// IPFS gateway client for fetching content-addressed mail payloads by CID
// FEATURE: IPFS storage layer for mail content addressing

export async function fetchCid(
  cid: string,
  gatewayUrl: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const r = await fetch(
    `${gatewayUrl.replace(/\/$/, "")}/ipfs/${cid}`,
    signal ? { signal } : {},
  );
  if (!r.ok) throw new Error(`gateway ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

export interface FetchCidOptions {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
}

export async function fetchCidWithFallback(
  cid: string,
  gateways: string[],
  opts: FetchCidOptions = {},
): Promise<Uint8Array> {
  if (gateways.length === 0) throw new Error("no gateways configured");
  const retries = opts.retries ?? 1;
  const backoffMs = opts.backoffMs ?? 250;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  let lastErr: unknown;
  for (const gateway of gateways) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetchCid(cid, gateway, AbortSignal.timeout(timeoutMs));
      } catch (err) {
        lastErr = err;
        if (attempt < retries) await sleep(backoffMs * (attempt + 1));
      }
    }
  }
  throw new Error(
    `all gateways failed for ${cid}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
