import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { ShopifySession } from "../integrations/shopify/shopify.types.js";

vi.mock("../integrations/shopify/shopify.config.js", () => {
  return {
    isValidShopDomain: (shop: string): boolean => {
      return /^[a-z0-9-]+\.myshopify\.com$/.test(shop.trim().toLowerCase());
    },
  };
});

vi.mock("../integrations/shopify/shopify.oauth.js", () => {
  return {
    beginAuth: vi.fn(() =>
      Promise.resolve("https://sirehshope.myshopify.com/admin/oauth/authorize"),
    ),
    completeAuth: vi.fn(
      (): Promise<ShopifySession> =>
        Promise.resolve({
          shop: "sirehshope.myshopify.com",
          accessToken: "secret-access-token",
          scope: ["read_products"],
          apiVersion: "2025-01",
          installedAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
    ),
    getSession: vi.fn(() => Promise.resolve(undefined)),
  };
});

import { shopifyRoutes } from "./shopify.routes.js";
import { completeAuth } from "../integrations/shopify/shopify.oauth.js";

describe("Shopify routes", () => {
  it("returns a safe OAuth callback response without exposing the access token", async () => {
    const app = express();
    app.use("/api/shopify", shopifyRoutes);

    const response = await request(app)
      .get("/api/shopify/auth/callback")
      .query({
        shop: "sirehshope.myshopify.com",
        code: "test-code",
        state: "test-state",
        hmac: "test-hmac",
        host: "test-host",
        timestamp: "1780000000",
      })
      .expect(200);

    expect(completeAuth).toHaveBeenCalledWith({
      shop: "sirehshope.myshopify.com",
      code: "test-code",
      state: "test-state",
      hmac: "test-hmac",
      host: "test-host",
      timestamp: "1780000000",
    });
    expect(response.body).toEqual({
      success: true,
      shop: "sirehshope.myshopify.com",
      connected: true,
      message: "Shopify store connected successfully.",
    });
    expect(JSON.stringify(response.body)).not.toContain("secret-access-token");
  });
});
