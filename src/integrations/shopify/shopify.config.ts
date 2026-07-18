/**
 * Project: Sireh AI Commerce Platform
 * Module: Shopify Configuration
 * Sprint: SACP-01.02
 * Author: Gemini Code Assist
 * Status: Production Ready
 */

import { env } from "../../config/env.js";
import type { ShopifyApiVersion } from "./shopify.types.js";

const SHOPIFY_API_VERSION = env.SHOPIFY_API_VERSION as ShopifyApiVersion;
const SHOPIFY_CALLBACK_PATH = "/api/shopify/auth/callback";

export const shopifyConfig = {
  apiKey: env.SHOPIFY_API_KEY,
  apiSecret: env.SHOPIFY_API_SECRET,
  appUrl: env.SHOPIFY_APP_URL,
  redirectUri: `${env.SHOPIFY_APP_URL}${SHOPIFY_CALLBACK_PATH}`,
  scopes: env.SHOPIFY_SCOPES,
  storeDomain: env.SHOPIFY_STORE_DOMAIN,
  apiVersion: SHOPIFY_API_VERSION,
  auth: {
    callbackPath: SHOPIFY_CALLBACK_PATH,
  },
};

const SHOPIFY_DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;

/**
 * Validates if the provided shop domain is a valid *.myshopify.com domain.
 * @param shop The shop domain to validate.
 * @returns True if the domain is valid, false otherwise.
 */
export function isValidShopDomain(shop: string): boolean {
  return typeof shop === "string" && SHOPIFY_DOMAIN_REGEX.test(shop.trim().toLowerCase());
}
