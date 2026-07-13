/**
 * Project: Sireh AI Commerce Platform
 * Module: Shopify Types
 * Sprint: SAI-03.01
 * Author: OpenAI + Codex
 * Status: Production Ready
 */

export type ShopifyShopDomain = `${string}.myshopify.com`;
export type ShopifyAccessToken = string;
export type ShopifyApiVersion = `${number}-${number}`;

export interface ShopifySession {
  readonly shop: ShopifyShopDomain;
  readonly accessToken: ShopifyAccessToken;
  readonly scope: readonly string[];
  readonly apiVersion: ShopifyApiVersion;
  readonly installedAt: Date;
  readonly updatedAt: Date;
}

export type ShopifyWebhookTopic =
  | "app/uninstalled"
  | "customers/data_request"
  | "customers/redact"
  | "orders/create"
  | "orders/paid"
  | "orders/updated"
  | "products/create"
  | "products/delete"
  | "products/update"
  | "shop/redact";

export type ShopifyWebhookPayload = Record<string, unknown>;

export interface ShopifyOAuthState {
  readonly state: string;
  readonly shop: ShopifyShopDomain;
  readonly nonce: string;
  readonly expiresAt: Date;
}

export interface ShopifyAuthCallbackQuery {
  readonly shop: ShopifyShopDomain;
  readonly code: string;
  readonly state: string;
  readonly hmac: string;
  readonly host?: string;
  readonly timestamp?: string;
}
