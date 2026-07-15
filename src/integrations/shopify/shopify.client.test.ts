import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../shared/errors/app-error.js";
import { ShopifyClient } from "./shopify.client.js";
import type { ShopifySessionRepository } from "../../database/repositories/shopify-session.repository.js";
import type { ShopifySession, ShopifyShopDomain } from "./shopify.types.js";

const TEST_SHOP: ShopifyShopDomain = "sirehshope.myshopify.com";

describe("ShopifyClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a saved access token and performs a successful Admin API request", async () => {
    const fetchMock = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        expect(input).toBe("https://sirehshope.myshopify.com/admin/api/2025-01/shop.json");
        expect(init?.headers).toMatchObject({
          "X-Shopify-Access-Token": "test-access-token",
          "Content-Type": "application/json",
        });

        return Promise.resolve(
          new Response(JSON.stringify({ shop: { name: "Sireh Shope" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = await ShopifyClient.forShop(
      TEST_SHOP,
      new InMemoryShopifySessionRepository(buildSession()),
    );

    await expect(client.getShop()).resolves.toEqual({
      shop: { name: "Sireh Shope" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects requests when no saved session exists", async () => {
    await expect(
      ShopifyClient.forShop(TEST_SHOP, new InMemoryShopifySessionRepository()),
    ).rejects.toThrow("No active session found for shop");
  });

  it("handles Shopify Admin API errors without exposing credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ errors: "Unavailable" }), {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    const client = await ShopifyClient.forShop(
      TEST_SHOP,
      new InMemoryShopifySessionRepository(buildSession()),
    );

    try {
      await client.getProducts();
      throw new Error("Expected request to fail.");
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }

      expect(error.message).not.toContain("test-access-token");
      expect(JSON.stringify(error.details)).not.toContain("test-access-token");
    }
  });

  it("retries Shopify rate-limit responses safely", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: "Rate limited" }), {
          status: 429,
          statusText: "Too Many Requests",
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ shop: { name: "Sireh Shope" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new ShopifyClient({
      shop: TEST_SHOP,
      accessToken: "test-access-token",
      apiVersion: "2025-01",
      maxRetries: 1,
    });

    await expect(client.getShop()).resolves.toEqual({
      shop: { name: "Sireh Shope" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("executes typed GraphQL Admin API requests", async () => {
    const fetchMock = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        expect(input).toBe("https://sirehshope.myshopify.com/admin/api/2025-01/graphql.json");
        expect(init?.method).toBe("POST");
        const body = init?.body;
        if (typeof body !== "string") {
          throw new Error("Expected Shopify GraphQL request body to be a string.");
        }
        expect(JSON.parse(body)).toEqual({
          query: "query ShopName { shop { name } }",
          variables: {},
        });

        return Promise.resolve(
          new Response(JSON.stringify({ data: { shop: { name: "Sireh Shope" } } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ShopifyClient({
      shop: TEST_SHOP,
      accessToken: "test-access-token",
      apiVersion: "2025-01",
    });

    await expect(
      client.graphql<{ readonly shop: { readonly name: string } }>(
        "query ShopName { shop { name } }",
      ),
    ).resolves.toEqual({ shop: { name: "Sireh Shope" } });
  });

  it("rejects top-level GraphQL errors without exposing credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              errors: [{ message: "Access denied", extensions: { code: "ACCESS_DENIED" } }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    const client = new ShopifyClient({
      shop: TEST_SHOP,
      accessToken: "test-access-token",
      apiVersion: "2025-01",
    });

    await expect(client.graphql('query Product { product(id: "x") { id } }')).rejects.toThrow(
      "Shopify Admin GraphQL operation failed",
    );
  });
});

class InMemoryShopifySessionRepository implements ShopifySessionRepository {
  public constructor(private readonly session?: ShopifySession) {}

  public saveSession(session: ShopifySession): Promise<ShopifySession> {
    return Promise.resolve(session);
  }

  public getSession(shopDomain: ShopifyShopDomain): Promise<ShopifySession | undefined> {
    if (this.session?.shop !== shopDomain) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(this.session);
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
    scope: ["read_products", "read_orders", "read_customers"],
    apiVersion: "2025-01",
    installedAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
