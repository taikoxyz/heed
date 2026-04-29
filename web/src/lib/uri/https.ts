import type { UriMatcher, UriResolver } from "./types";

export const matchHttps: UriMatcher = (uri) => uri.startsWith("https://");

export const resolveHttps: UriResolver = async (uri) => {
  let host = uri;
  try {
    host = new URL(uri).host;
  } catch {
    return { raw: uri, source: "unknown", verified: false };
  }
  return {
    raw: uri,
    source: "https",
    display_name: host,
    verified: false,
  };
};
