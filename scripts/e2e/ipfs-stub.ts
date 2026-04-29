import { createServer, type Server } from "node:http";
import { sha256 } from "@noble/hashes/sha256";
import { digestToCid, cidToDigest } from "@heed/core";

export interface IpfsStub {
  url: string;
  pin: (bytes: Uint8Array) => string;
  close: () => Promise<void>;
}

export async function startIpfsStub(port = 0): Promise<IpfsStub> {
  const store = new Map<string, Uint8Array>();

  const pin = (bytes: Uint8Array): string => {
    const cid = digestToCid(sha256(bytes));
    store.set(cid, bytes);
    return cid;
  };

  const server: Server = createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end("missing url");
      return;
    }
    const match = req.url.match(/^\/ipfs\/([^/?#]+)/);
    if (req.method === "GET" && match) {
      const cid = match[1]!;
      const bytes = store.get(cid);
      if (!bytes) {
        res.statusCode = 404;
        res.end("not pinned");
        return;
      }
      try {
        cidToDigest(cid);
      } catch {
        res.statusCode = 400;
        res.end("invalid cid");
        return;
      }
      res.statusCode = 200;
      res.setHeader("content-type", "application/octet-stream");
      res.end(Buffer.from(bytes));
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("ipfs stub: failed to bind");
  const url = `http://127.0.0.1:${addr.port}`;

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { url, pin, close };
}
