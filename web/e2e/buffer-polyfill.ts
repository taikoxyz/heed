// @heed/core's lockbox base64 helpers use Node's Buffer, which the browser
// does not provide. Inject a minimal Buffer shim (from / toString('base64'))
// before app code runs so in-browser decryption succeeds under the dev server.
export function bufferPolyfillInit(): string {
  return `(${installBufferPolyfill.toString()})();`;
}

function installBufferPolyfill() {
  if ((globalThis as { Buffer?: unknown }).Buffer) return;

  function toBase64(this: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]!);
    return btoa(bin);
  }

  const Buffer = {
    from(input: ArrayLike<number> | string, encoding?: string): Uint8Array {
      let out: Uint8Array;
      if (typeof input === "string") {
        const bin = encoding === "base64" ? atob(input) : input;
        out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      } else {
        out = Uint8Array.from(input);
      }
      const orig = out.toString.bind(out);
      (out as Uint8Array & { toString: (e?: string) => string }).toString = (
        e?: string,
      ) => (e === "base64" ? toBase64.call(out) : orig());
      return out;
    },
  };

  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}
