// Pinata IPFS pinning client for uploading encrypted mail payloads
// FEATURE: IPFS storage layer for mail content addressing

export interface PinataConfig { jwt: string; gateway?: string }

export async function pin(bytes: Uint8Array, name: string, cfg: PinataConfig): Promise<string> {
  const fd = new FormData();
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  fd.append("file", new Blob([view]), name);
  fd.append("pinataMetadata", JSON.stringify({ name }));
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.jwt}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`pinata ${r.status}`);
  const { IpfsHash } = await r.json();
  return IpfsHash;
}
