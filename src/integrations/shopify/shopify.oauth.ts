/**
 * Project: Sireh AI Commerce Platform
 * Module: Shopify OAuth Service
 * Sprint: SACP-01.02
 * Author: Gemini Code Assist
 * Status: Production Ready
 */

import crypto from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import {
  shopifySessionRepository,
  type ShopifySessionRepository,
} from "../../database/repositories/shopify-session.repository.js";
import { isValidShopDomain, shopifyConfig } from "./shopify.config.js";
import {
  consumeOAuthState,
  deleteOAuthState,
  getOAuthState,
  hashOAuthState,
  saveOAuthState,
} from "./shopify-oauth-state.store.js";
import type {
  ShopifyAuthCallbackQuery,
  ShopifySession,
  ShopifyShopDomain,
} from "./shopify.types.js";
import { validateHmac } from "./shopify.hmac.js";

let activeSessionRepository: ShopifySessionRepository = shopifySessionRepository;

/**
 * Initiates the Shopify OAuth flow.
 * @param shop - The shop domain.
 * @returns The URL to redirect the user to for authorization.
 */
export async function beginAuth(shop: string): Promise<string> {
  const normalizedShop = normalizeShop(shop);

  if (!isValidShopDomain(normalizedShop)) {
    throw AppError.badRequest("Invalid shop domain provided.");
  }

  const state = crypto.randomBytes(32).toString("hex");
  await saveOAuthState(state, normalizedShop);
  const stateHash = hashOAuthState(state);

  console.info("Shopify OAuth state generated", {
    processPid: process.pid,
    stateHashPrefix: stateHash.slice(0, 8),
    shop: normalizedShop,
  });

  const authorizeUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", shopifyConfig.apiKey);
  authorizeUrl.searchParams.set("scope", shopifyConfig.scopes);
  authorizeUrl.searchParams.set("redirect_uri", shopifyConfig.redirectUri);
  authorizeUrl.searchParams.set("state", state);

  return authorizeUrl.toString();
}

/**
 * Completes the Shopify OAuth flow by exchanging the authorization code for an access token.
 * @param query - The callback query parameters from Shopify.
 * @returns The newly created Shopify session.
 */
export async function completeAuth(
  query: ShopifyAuthCallbackQuery,
): Promise<ShopifySession> {
  const { shop, code, state, hmac } = query;
  const normalizedShop = normalizeShop(shop);

  if (!isValidShopDomain(normalizedShop)) {
    throw AppError.badRequest("Invalid shop domain provided.");
  }

  if (typeof state !== "string" || state.trim().length === 0) {
    throw AppError.forbidden("Invalid state. OAuth request cannot be verified.");
  }

  if (typeof hmac !== "string" || hmac.trim().length === 0) {
    throw AppError.forbidden("Invalid HMAC. Request could not be authenticated.");
  }

  const stateHash = hashOAuthState(state);
  const storedState = await getOAuthState(state);

  console.log("Shopify OAuth state lookup", {
    processPid: process.pid,
    stateHashPrefix: stateHash.slice(0, 8),
    statePresent: state.length > 0,
    storedStateFound: storedState !== undefined,
    shop: normalizedShop,
  });

  console.info("Shopify OAuth callback state validation", {
    processPid: process.pid,
    stateHashPrefix: stateHash.slice(0, 8),
    shop: normalizedShop,
    storedStateFound: storedState !== undefined,
  });

  await consumeOAuthState(state, normalizedShop);

  if (!validateHmac(toHmacQuery(query, normalizedShop))) {
    throw AppError.forbidden("Invalid HMAC. Request could not be authenticated.");
  }

  const session = await exchangeAccessToken(normalizedShop, code);
  await deleteOAuthState(state);

  return session;
}

export async function exchangeAccessToken(
  shop: ShopifyShopDomain,
  code: string,
): Promise<ShopifySession> {
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: shopifyConfig.apiKey,
      client_secret: shopifyConfig.apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw AppError.internal("Failed to exchange authorization code for access token.");
  }

  const tokenData = validateTokenResponse(await response.json());
  const now = new Date();

  const session: ShopifySession = {
    shop,
    accessToken: tokenData.access_token,
    scope: normalizeScopes(tokenData.scope),
    apiVersion: shopifyConfig.apiVersion,
    installedAt: now,
    updatedAt: now,
  };

  return saveSession(session);
}

export async function saveSession(session: ShopifySession): Promise<ShopifySession> {
  return activeSessionRepository.saveSession(session);
}

/**
 * Retrieves the session for a given shop.
 * @param shop - The shop domain.
 * @returns The Shopify session, or undefined if not found.
 */
export function getSession(shop: ShopifyShopDomain): Promise<ShopifySession | undefined> {
  return activeSessionRepository.getSession(shop);
}

export function setShopifySessionRepositoryForTesting(
  repository: ShopifySessionRepository,
): void {
  activeSessionRepository = repository;
}

export function resetShopifySessionRepositoryForTesting(): void {
  activeSessionRepository = shopifySessionRepository;
}

function normalizeShop(shop: string): ShopifyShopDomain {
  return shop.trim().toLowerCase() as ShopifyShopDomain;
}

function normalizeScopes(scopes: string): readonly string[] {
  return [...new Set(scopes.split(",").map((scope) => scope.trim()).filter(Boolean))].sort();
}

function validateTokenResponse(value: unknown): {
  readonly access_token: string;
  readonly scope: string;
} {
  if (!isRecord(value)) {
    throw AppError.internal("Invalid Shopify token response.");
  }

  if (
    typeof value.access_token !== "string" ||
    value.access_token.trim().length === 0 ||
    typeof value.scope !== "string"
  ) {
    throw AppError.internal("Invalid Shopify token response.");
  }

  return {
    access_token: value.access_token,
    scope: value.scope,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function toHmacQuery(
  query: ShopifyAuthCallbackQuery,
  normalizedShop: ShopifyShopDomain,
): Record<string, string> {
  return {
    shop: normalizedShop,
    code: query.code,
    state: query.state,
    hmac: query.hmac,
    ...(query.host === undefined ? {} : { host: query.host }),
    ...(query.timestamp === undefined ? {} : { timestamp: query.timestamp }),
  };
}

