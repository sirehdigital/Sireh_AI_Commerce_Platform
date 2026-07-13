/**
 * Project: Sireh AI Commerce Platform
 * Module: Shopify Routes
 * Sprint: SACP-01.02
 * Author: Gemini Code Assist
 * Status: Production Ready
 */

import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { isValidShopDomain } from "../integrations/shopify/shopify.config.js";
import {
  beginAuth,
  completeAuth,
  getSession,
} from "../integrations/shopify/shopify.oauth.js";
import { hashOAuthState } from "../integrations/shopify/shopify-oauth-state.store.js";
import { ShopifyClient } from "../integrations/shopify/shopify.client.js";
import { shopifyConnectionValidationService } from "../integrations/shopify/shopify-connection-validation.service.js";
import { shopifySyncService } from "../integrations/shopify/shopify-sync.service.js";
import type {
  ShopifyAuthCallbackQuery,
  ShopifyShopDomain,
} from "../integrations/shopify/shopify.types.js";

const router = Router();

type AsyncRouteHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

const asyncHandler =
  (handler: AsyncRouteHandler) =>
  (request: Request, response: Response, next: NextFunction): void => {
    void Promise.resolve(handler(request, response, next)).catch(next);
  };

function getQueryValue(request: Request, key: string): string | undefined {
  const value = request.query[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeShop(shop: string): ShopifyShopDomain {
  return shop.trim().toLowerCase() as ShopifyShopDomain;
}

function getShopDomain(request: Request): ShopifyShopDomain | undefined {
  const shop = getQueryValue(request, "shop");

  if (shop === undefined || !isValidShopDomain(shop)) {
    return undefined;
  }

  return normalizeShop(shop);
}

function getShopifyAuthCallbackQuery(request: Request): ShopifyAuthCallbackQuery | undefined {
  const shop = typeof request.query.shop === "string" ? request.query.shop : "";
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state = typeof request.query.state === "string" ? request.query.state : "";
  const hmac = typeof request.query.hmac === "string" ? request.query.hmac : "";
  const host = typeof request.query.host === "string" ? request.query.host : undefined;
  const timestamp =
    typeof request.query.timestamp === "string" ? request.query.timestamp : undefined;

  console.log("Shopify OAuth callback received", {
    processPid: process.pid,
    statePresent: state.length > 0,
    stateHashPrefix: state.length === 0 ? "" : hashOAuthState(state).slice(0, 8),
    shop,
    queryKeys: Object.keys(request.query),
  });

  if (!isValidShopDomain(shop) || code.length === 0 || state.length === 0 || hmac.length === 0) {
    return undefined;
  }

  return {
    shop: normalizeShop(shop),
    code,
    state,
    hmac,
    ...(host === undefined ? {} : { host }),
    ...(timestamp === undefined ? {} : { timestamp }),
  };
}

router.get(
  "/auth/start",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    response.redirect(await beginAuth(shop));
  }),
);

router.get(
  "/auth/callback",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const query = getShopifyAuthCallbackQuery(request);

    if (query === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_OAUTH_CALLBACK",
          message: "Shopify OAuth callback is missing required query parameters.",
        },
      });
      return;
    }

    const session = await completeAuth(query);

    response.status(200).json({
      success: true,
      shop: session.shop,
      connected: true,
      message: "Shopify store connected successfully.",
    });
  }),
);

router.get(
  "/store",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    const session = await getSession(shop);
    if (session === undefined) {
      response.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: `No active session found for shop: ${shop}. Please install the app first.`,
        },
      });
      return;
    }

    const client = new ShopifyClient({
      shop: session.shop,
      accessToken: session.accessToken,
      apiVersion: session.apiVersion,
    });
    const storeData = await client.getShop();

    response.status(200).json({
      success: true,
      data: storeData,
    });
  }),
);

router.get(
  "/products",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    const session = await getSession(shop);
    if (session === undefined) {
      response.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: `No active session found for shop: ${shop}. Please install the app first.`,
        },
      });
      return;
    }

    const client = new ShopifyClient({
      shop: session.shop,
      accessToken: session.accessToken,
      apiVersion: session.apiVersion,
    });
    const productsData = await client.getProducts();

    response.status(200).json({
      success: true,
      data: productsData,
    });
  }),
);

router.get(
  "/orders",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    const session = await getSession(shop);
    if (session === undefined) {
      response.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: `No active session found for shop: ${shop}. Please install the app first.`,
        },
      });
      return;
    }

    const client = new ShopifyClient({
      shop: session.shop,
      accessToken: session.accessToken,
      apiVersion: session.apiVersion,
    });
    const ordersData = await client.getOrders();

    response.status(200).json({
      success: true,
      data: ordersData,
    });
  }),
);

router.get(
  "/customers",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    const session = await getSession(shop);
    if (session === undefined) {
      response.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: `No active session found for shop: ${shop}. Please install the app first.`,
        },
      });
      return;
    }

    const client = new ShopifyClient({
      shop: session.shop,
      accessToken: session.accessToken,
      apiVersion: session.apiVersion,
    });
    const customersData = await client.getCustomers();

    response.status(200).json({
      success: true,
      data: customersData,
    });
  }),
);

router.get(
  "/connection-status",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    response.status(200).json({
      success: true,
      data: await shopifyConnectionValidationService.validate(shop),
    });
  }),
);

router.post(
  "/sync",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    response.status(200).json({
      success: true,
      data: await shopifySyncService.sync(shop),
    });
  }),
);

router.get(
  "/sync/status",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    response.status(200).json({
      success: true,
      data: await shopifySyncService.getStatus(shop),
    });
  }),
);

router.get(
  "/sync/summary",
  asyncHandler(async (request: Request, response: Response): Promise<void> => {
    const shop = getShopDomain(request);

    if (shop === undefined) {
      response.status(400).json({
        success: false,
        error: {
          code: "INVALID_SHOP_DOMAIN",
          message: "A valid *.myshopify.com shop domain must be provided.",
        },
      });
      return;
    }

    response.status(200).json({
      success: true,
      data: await shopifySyncService.getSummary(shop),
    });
  }),
);

export const shopifyRoutes = router;
