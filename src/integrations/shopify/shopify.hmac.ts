/**
 * Project: Sireh AI Commerce Platform
 * Module: Shopify HMAC Validation
 * Sprint: SACP-01.02
 * Author: Gemini Code Assist
 * Status: Production Ready
 */

import crypto from "node:crypto";
import { shopifyConfig } from "./shopify.config.js";

const SHOPIFY_HMAC_HEX_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Validates the HMAC signature of a Shopify request.
 * @param query - The query parameters from the Shopify request.
 * @returns True if the HMAC is valid, false otherwise.
 */
export function validateHmac(query: Record<string, string>): boolean {
  const { hmac } = query;
  if (typeof hmac !== "string" || !SHOPIFY_HMAC_HEX_PATTERN.test(hmac)) {
    return false;
  }

  const message = canonicalizeShopifyHmacMessage(query);

  const generatedHmac = crypto
    .createHmac("sha256", shopifyConfig.apiSecret)
    .update(message)
    .digest("hex");

  console.log("Shopify HMAC validation", {
    calculatedHmacPrefix: generatedHmac.slice(0, 8),
    receivedHmacPrefix: hmac.slice(0, 8),
    messageKeys: getSignedMessageKeys(query),
  });

  const generatedBuffer = Buffer.from(generatedHmac, "hex");
  const providedBuffer = Buffer.from(hmac, "hex");

  if (generatedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, providedBuffer);
}

export function verifyShopifyHmac(searchParams: URLSearchParams): boolean {
  return validateHmac(Object.fromEntries(searchParams.entries()));
}

export function canonicalizeShopifyHmacMessage(query: Record<string, string>): string {
  return Object.entries(query)
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function getSignedMessageKeys(query: Record<string, string>): readonly string[] {
  return Object.keys(query)
    .filter((key) => key !== "hmac" && key !== "signature")
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey));
}
