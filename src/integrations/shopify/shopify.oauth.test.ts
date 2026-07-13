import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./shopify.config.js", () => {
  return {
    shopifyConfig: {
      apiKey: "test-shopify-api-key",
      apiSecret: "test-shopify-api-secret",
      appUrl: "https://app.example.com",
      redirectUri: "https://app.example.com/api/shopify/auth/callback",
      scopes: "read_products,write_products",
      storeDomain: "sirehshope.myshopify.com",
      apiVersion: "2025-01",
      auth: {
        callbackPath: "/api/shopify/auth/callback",
      },
    },
    isValidShopDomain: (shop: string): boolean => {
      return /^[a-z0-9-]+\.myshopify\.com$/.test(shop.trim().toLowerCase());
    },
  };
});

import { shopifyConfig } from "./shopify.config.js";
import {
  beginAuth,
  completeAuth,
  resetShopifySessionRepositoryForTesting,
  setShopifySessionRepositoryForTesting,
} from "./shopify.oauth.js";
import {
  resetOAuthStateRepositoryForTesting,
  setOAuthStateRepositoryForTesting,
  type OAuthStateRecord,
  type ShopifyOAuthStateRepository,
} from "./shopify-oauth-state.store.js";
import type { ShopifySessionRepository } from "../../database/repositories/shopify-session.repository.js";
import type {
  ShopifyAuthCallbackQuery,
  ShopifySession,
  ShopifyShopDomain,
} from "./shopify.types.js";

const DEFAULT_TEST_SHOP: ShopifyShopDomain = "sirehshope.myshopify.com";

describe("Shopify OAuth recovery", () => {
  beforeEach(() => {
    setShopifySessionRepositoryForTesting(new InMemoryShopifySessionRepository());
    setOAuthStateRepositoryForTesting(new InMemoryShopifyOAuthStateRepository());
  });

  afterEach(() => {
    resetShopifySessionRepositoryForTesting();
    resetOAuthStateRepositoryForTesting();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates an authorization URL for a valid shop", async () => {
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));

    expect(authorizeUrl.origin).toBe("https://sirehshope.myshopify.com");
    expect(authorizeUrl.pathname).toBe("/admin/oauth/authorize");
    expect(authorizeUrl.searchParams.get("client_id")).toBe(shopifyConfig.apiKey);
  });

  it("rejects invalid shop domains", async () => {
    await expect(beginAuth("not-shopify.example.com")).rejects.toThrow(
      "Invalid shop domain provided.",
    );
  });

  it("includes the configured redirect URI", async () => {
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));

    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(shopifyConfig.redirectUri);
  });

  it("includes a generated state", async () => {
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));

    expect(authorizeUrl.searchParams.get("state")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stores state by generated state value and resolves a fresh callback", async () => {
    stubSuccessfulTokenExchange();
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    const session = await completeAuth(buildSignedCallback({ state }));

    expect(session.shop).toBe("sirehshope.myshopify.com");
    expect(session.accessToken).toBe("test-access-token");
  });

  it("rejects missing state", async () => {
    await expect(
      completeAuth(buildSignedCallback({ state: "missing-state" })),
    ).rejects.toThrow("Invalid state. OAuth request cannot be verified.");
  });

  it("rejects expired state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    vi.setSystemTime(new Date("2026-01-01T00:11:00.000Z"));

    await expect(
      completeAuth(buildSignedCallback({ state })),
    ).rejects.toThrow("Invalid state. OAuth request cannot be verified.");
  });

  it("rejects shop mismatch", async () => {
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    await expect(
      completeAuth(buildSignedCallback({ shop: "othershop.myshopify.com", state })),
    ).rejects.toThrow("Invalid state. OAuth request cannot be verified.");
  });

  it("does not delete unrelated valid state after failed state validation", async () => {
    stubSuccessfulTokenExchange();
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    await expect(
      completeAuth(buildSignedCallback({ state: "missing-state" })),
    ).rejects.toThrow("Invalid state. OAuth request cannot be verified.");

    await expect(completeAuth(buildSignedCallback({ state }))).resolves.toMatchObject({
      shop: "sirehshope.myshopify.com",
    });
  });

  it("does not complete OAuth when HMAC validation fails", async () => {
    const tokenExchange = stubSuccessfulTokenExchange();
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");
    const query = buildSignedCallback({ state });

    await expect(
      completeAuth({ ...query, hmac: "invalid-hmac" }),
    ).rejects.toThrow("Invalid HMAC. Request could not be authenticated.");

    expect(tokenExchange).not.toHaveBeenCalled();
  });

  it("removes state after successful validation", async () => {
    stubSuccessfulTokenExchange();
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");
    const query = buildSignedCallback({ state });

    await completeAuth(query);

    await expect(completeAuth(query)).rejects.toThrow(
      "Invalid state. OAuth request cannot be verified.",
    );
  });
});

class InMemoryShopifySessionRepository implements ShopifySessionRepository {
  private readonly sessions = new Map<ShopifyShopDomain, ShopifySession>();

  public saveSession(session: ShopifySession): Promise<ShopifySession> {
    this.sessions.set(session.shop, session);

    return Promise.resolve(session);
  }

  public getSession(shopDomain: ShopifyShopDomain): Promise<ShopifySession | undefined> {
    return Promise.resolve(this.sessions.get(shopDomain));
  }

  public deleteSession(shopDomain: ShopifyShopDomain): Promise<void> {
    this.sessions.delete(shopDomain);

    return Promise.resolve();
  }

  public hasSession(shopDomain: ShopifyShopDomain): Promise<boolean> {
    return Promise.resolve(this.sessions.has(shopDomain));
  }
}

class InMemoryShopifyOAuthStateRepository implements ShopifyOAuthStateRepository {
  private readonly records: {
    readonly stateHash: string;
    readonly shop: string;
    readonly expiresAt: number;
  }[] = [];

  public saveOAuthState(state: string, shopDomain: string): Promise<void> {
    const stateHash = this.hashState(state);
    const index = this.records.findIndex((record) => record.stateHash === stateHash);
    const record = {
      stateHash,
      shop: shopDomain.trim().toLowerCase(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    if (index >= 0) {
      this.records.splice(index, 1, record);
      return Promise.resolve();
    }

    this.records.push(record);
    return Promise.resolve();
  }

  public getOAuthState(state: string): Promise<OAuthStateRecord | undefined> {
    const record = this.findRecord(state);
    return Promise.resolve(
      record === undefined ? undefined : { shop: record.shop, expiresAt: record.expiresAt },
    );
  }

  public deleteOAuthState(state: string): Promise<void> {
    const index = this.records.findIndex((record) => record.stateHash === this.hashState(state));
    if (index >= 0) {
      this.records.splice(index, 1);
    }
    return Promise.resolve();
  }

  public async consumeOAuthState(state: string, shopDomain: string): Promise<OAuthStateRecord> {
    const record = this.findRecord(state);

    if (record === undefined) {
      throw new Error("Invalid state. OAuth request cannot be verified.");
    }

    if (record.expiresAt < Date.now()) {
      await this.deleteOAuthState(state);
      throw new Error("Invalid state. OAuth request cannot be verified.");
    }

    if (record.shop !== shopDomain.trim().toLowerCase()) {
      throw new Error("Invalid state. OAuth request cannot be verified.");
    }

    return {
      shop: record.shop,
      expiresAt: record.expiresAt,
    };
  }

  public getOAuthStateCount(): Promise<number> {
    return Promise.resolve(this.records.length);
  }

  public hashState(state: string): string {
    return crypto.createHash("sha256").update(state).digest("hex");
  }

  private findRecord(state: string): {
    readonly stateHash: string;
    readonly shop: string;
    readonly expiresAt: number;
  } | undefined {
    const stateHash = this.hashState(state);
    return this.records.find((record) => record.stateHash === stateHash);
  }
}

function buildSignedCallback(
  overrides: Partial<ShopifyAuthCallbackQuery> = {},
): ShopifyAuthCallbackQuery {
  const baseQuery: Omit<ShopifyAuthCallbackQuery, "hmac"> = {
    shop: overrides.shop ?? DEFAULT_TEST_SHOP,
    code: overrides.code ?? "test-code",
    state: overrides.state ?? "test-state",
    ...(overrides.host === undefined ? {} : { host: overrides.host }),
    timestamp: overrides.timestamp ?? "1780000000",
  };

  return {
    ...baseQuery,
    hmac: overrides.hmac ?? signQuery(baseQuery),
  };
}

function signQuery(query: Omit<ShopifyAuthCallbackQuery, "hmac">): string {
  const message = new URLSearchParams(query).toString();

  return crypto.createHmac("sha256", shopifyConfig.apiSecret).update(message).digest("hex");
}

function requireSearchParam(url: URL, key: string): string {
  const value = url.searchParams.get(key);

  if (value === null) {
    throw new Error(`Missing search parameter: ${key}`);
  }

  return value;
}

function stubSuccessfulTokenExchange(): ReturnType<typeof vi.fn> {
  const tokenExchange = vi.fn((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    void input;
    void init;

    return Promise.resolve(
      new Response(
        JSON.stringify({
          access_token: "test-access-token",
          scope: "read_products,write_products",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  });

  vi.stubGlobal("fetch", tokenExchange);

  return tokenExchange;
}
