import { describe, expect, it } from "vitest";
import type { ShopifySessionRepository } from "../../database/repositories/shopify-session.repository.js";
import { shopifyConfig } from "./shopify.config.js";
import { ShopifyConnectionValidationService } from "./shopify-connection-validation.service.js";
import type { ShopifySession, ShopifyShopDomain } from "./shopify.types.js";

const TEST_SHOP: ShopifyShopDomain = "sirehshope.myshopify.com";

describe("ShopifyConnectionValidationService", () => {
  it("validates a connected shop with required scopes", async () => {
    const service = new ShopifyConnectionValidationService(
      new SessionRepository(buildSession()),
      () =>
        Promise.resolve({
          getShop: () =>
            Promise.resolve({
              shop: { myshopify_domain: TEST_SHOP },
            }),
        }),
    );

    await expect(service.validate(TEST_SHOP)).resolves.toMatchObject({
      shopDomain: TEST_SHOP,
      connected: true,
      apiReachable: true,
      tokenValid: true,
      requiredScopesPresent: true,
      missingScopes: [],
    });
  });

  it("returns a safe disconnected result when the session is missing", async () => {
    const service = new ShopifyConnectionValidationService(new SessionRepository());

    await expect(service.validate(TEST_SHOP)).resolves.toMatchObject({
      connected: false,
      apiReachable: false,
      tokenValid: false,
    });
  });

  it("marks the token invalid when Shopify rejects the Admin API request", async () => {
    const service = new ShopifyConnectionValidationService(
      new SessionRepository(buildSession()),
      () =>
        Promise.resolve({
          getShop: () => Promise.reject(new Error("Unauthorized")),
        }),
    );

    await expect(service.validate(TEST_SHOP)).resolves.toMatchObject({
      connected: false,
      apiReachable: false,
      tokenValid: false,
    });
  });

  it("reports missing scopes without exposing credentials", async () => {
    const service = new ShopifyConnectionValidationService(
      new SessionRepository({ ...buildSession(), scope: ["read_products"] }),
      () =>
        Promise.resolve({
          getShop: () =>
            Promise.resolve({
              shop: { myshopify_domain: TEST_SHOP },
            }),
        }),
    );

    const result = await service.validate(TEST_SHOP);

    expect(result.requiredScopesPresent).toBe(false);
    expect(result.missingScopes.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("test-access-token");
  });
});

class SessionRepository implements ShopifySessionRepository {
  public constructor(private readonly session?: ShopifySession) {}

  public saveSession(session: ShopifySession): Promise<ShopifySession> {
    return Promise.resolve(session);
  }

  public getSession(shopDomain: ShopifyShopDomain): Promise<ShopifySession | undefined> {
    return Promise.resolve(this.session?.shop === shopDomain ? this.session : undefined);
  }

  public deleteSession(shopDomain: ShopifyShopDomain): Promise<void> {
    void shopDomain;
    return Promise.resolve();
  }

  public hasSession(shopDomain: ShopifyShopDomain): Promise<boolean> {
    return Promise.resolve(this.session?.shop === shopDomain);
  }
}

function buildSession(): ShopifySession {
  return {
    shop: TEST_SHOP,
    accessToken: "test-access-token",
    scope: shopifyConfig.scopes.split(",").map((scope) => scope.trim()),
    apiVersion: shopifyConfig.apiVersion,
    installedAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
