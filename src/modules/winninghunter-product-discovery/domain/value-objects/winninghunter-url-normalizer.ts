import { createHash } from "node:crypto";

import { WinningHunterUnsupportedUrlError } from "../errors/winninghunter-product-discovery.errors.js";

const TRACKING_PARAMETER_NAMES = new Set([
  "fbclid",
  "gclid",
  "tw_source",
  "tw_adid",
  "msclkid",
  "mc_cid",
  "mc_eid",
]);

export interface NormalizedWinningHunterUrl {
  readonly url: string;
  readonly domain: string;
  readonly productHandle?: string;
}

export function createStableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function normalizeWinningHunterUrl(rawUrl: string): NormalizedWinningHunterUrl {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new WinningHunterUnsupportedUrlError();
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new WinningHunterUnsupportedUrlError();
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";

  for (const parameterName of [...parsed.searchParams.keys()]) {
    const normalizedParameterName = parameterName.toLowerCase();

    if (
      normalizedParameterName.startsWith("utm_") ||
      TRACKING_PARAMETER_NAMES.has(normalizedParameterName)
    ) {
      parsed.searchParams.delete(parameterName);
    }
  }

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  }

  parsed.searchParams.sort();

  return {
    url: parsed.toString(),
    domain: parsed.hostname,
    ...extractShopifyProductHandle(parsed.pathname),
  };
}

function extractShopifyProductHandle(pathname: string): { readonly productHandle?: string } {
  const match = /^\/products\/([^/?#]+)/u.exec(pathname);
  const handle = match?.[1]?.trim();

  return handle === undefined || handle.length === 0 ? {} : { productHandle: handle };
}
