// Pinata IPFS pinning client for uploading encrypted mail payloads
// FEATURE: IPFS storage layer for mail content addressing

export interface PinataConfig { jwt: string; gateway?: string }

export async function pin(bytes: Uint8Array, name: string, cfg: PinataConfig): Promise<string> {
  const fd = new FormData();
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  fd.append("file", new Blob([view]), name);
  fd.append("pinataMetadata", JSON.stringify({ name }));
  fd.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.jwt}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`pinata ${r.status}: ${await r.text()}`);
  const { IpfsHash } = await r.json();
  return IpfsHash;
}

export async function pinJson(
  payload: unknown,
  name: string,
  cfg: PinataConfig,
): Promise<string> {
  const r = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: payload,
      pinataMetadata: { name },
      pinataOptions: { cidVersion: 1 },
    }),
  });
  if (!r.ok) throw new Error(`pinata ${r.status}: ${await r.text()}`);
  const { IpfsHash } = await r.json();
  return IpfsHash;
}
