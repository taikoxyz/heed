// IPFS gateway client for fetching content-addressed mail payloads by CID
// FEATURE: IPFS storage layer for mail content addressing

export async function fetchCid(cid: string, gatewayUrl: string): Promise<Uint8Array> {
  const r = await fetch(`${gatewayUrl.replace(/\/$/, "")}/ipfs/${cid}`);
  if (!r.ok) throw new Error(`gateway ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
