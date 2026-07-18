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
      return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/.test(
        shop.trim().toLowerCase(),
      );
    },
  };
});

import { shopifyConfig } from "./shopify.config.js";
import { canonicalizeShopifyHmacMessage, validateHmac } from "./shopify.hmac.js";
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
  let sessionRepository: InMemoryShopifySessionRepository;

  beforeEach(() => {
    sessionRepository = new InMemoryShopifySessionRepository();
    setShopifySessionRepositoryForTesting(sessionRepository);
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
    await expect(beginAuth("https://sirehshope.myshopify.com")).rejects.toThrow(
      "Invalid shop domain provided.",
    );
    await expect(beginAuth("sirehshope.myshopify.com/admin")).rejects.toThrow(
      "Invalid shop domain provided.",
    );
    await expect(beginAuth("-sirehshope.myshopify.com")).rejects.toThrow(
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

  it("creates sessions only after complete OAuth validation and stores deterministic scopes", async () => {
    stubSuccessfulTokenExchange("test-access-token", "write_products,read_products,read_products");
    const authorizeUrl = new URL(await beginAuth("SIREHSHOPE.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    await expect(completeAuth(buildSignedCallback({ state }))).resolves.toMatchObject({
      shop: "sirehshope.myshopify.com",
      scope: ["read_products", "write_products"],
    });

    await expect(sessionRepository.getSession(DEFAULT_TEST_SHOP)).resolves.toMatchObject({
      shop: DEFAULT_TEST_SHOP,
      scope: ["read_products", "write_products"],
    });
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

  it("does not overwrite an existing session after failed HMAC validation", async () => {
    const existingSession = buildSession({
      accessToken: "existing-access-token",
      scope: ["read_products"],
    });
    await sessionRepository.saveSession(existingSession);
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");
    const query = buildSignedCallback({ state });

    await expect(
      completeAuth({ ...query, hmac: "f".repeat(64) }),
    ).rejects.toThrow("Invalid HMAC. Request could not be authenticated.");

    await expect(sessionRepository.getSession(DEFAULT_TEST_SHOP)).resolves.toEqual(
      existingSession,
    );
  });

  it("does not create a session after invalid state", async () => {
    stubSuccessfulTokenExchange();

    await expect(
      completeAuth(buildSignedCallback({ state: "missing-state" })),
    ).rejects.toThrow("Invalid state. OAuth request cannot be verified.");

    await expect(sessionRepository.getSession(DEFAULT_TEST_SHOP)).resolves.toBeUndefined();
  });

  it("does not create a session after token-exchange failure", async () => {
    stubFailedTokenExchange();
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    await expect(completeAuth(buildSignedCallback({ state }))).rejects.toThrow(
      "Failed to exchange authorization code for access token.",
    );

    await expect(sessionRepository.getSession(DEFAULT_TEST_SHOP)).resolves.toBeUndefined();
  });

  it("does not create a session after invalid token response shape", async () => {
    stubInvalidTokenExchange();
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    await expect(completeAuth(buildSignedCallback({ state }))).rejects.toThrow(
      "Invalid Shopify token response.",
    );

    await expect(sessionRepository.getSession(DEFAULT_TEST_SHOP)).resolves.toBeUndefined();
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

  it("supports simultaneous states for multiple stores", async () => {
    stubSuccessfulTokenExchange();
    const firstUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const secondUrl = new URL(await beginAuth("second-shop.myshopify.com"));
    const firstState = requireSearchParam(firstUrl, "state");
    const secondState = requireSearchParam(secondUrl, "state");

    await expect(
      completeAuth(buildSignedCallback({ shop: "second-shop.myshopify.com", state: secondState })),
    ).resolves.toMatchObject({ shop: "second-shop.myshopify.com" });

    await expect(completeAuth(buildSignedCallback({ state: firstState }))).resolves.toMatchObject({
      shop: "sirehshope.myshopify.com",
    });
  });

  it("updates only the matching shop session after successful reauthorization", async () => {
    stubSuccessfulTokenExchange("updated-access-token");
    const unrelatedSession = buildSession({
      shop: "second-shop.myshopify.com",
      accessToken: "unrelated-access-token",
    });
    await sessionRepository.saveSession(buildSession({ accessToken: "old-access-token" }));
    await sessionRepository.saveSession(unrelatedSession);
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    await expect(completeAuth(buildSignedCallback({ state }))).resolves.toMatchObject({
      shop: "sirehshope.myshopify.com",
      accessToken: "updated-access-token",
    });

    await expect(sessionRepository.getSession("second-shop.myshopify.com")).resolves.toEqual(
      unrelatedSession,
    );
  });

  it("preserves an existing valid session after token-exchange failure during reauthorization", async () => {
    stubFailedTokenExchange();
    const existingSession = buildSession({
      accessToken: "existing-access-token",
      scope: ["read_products"],
    });
    const unrelatedSession = buildSession({
      shop: "second-shop.myshopify.com",
      accessToken: "unrelated-access-token",
    });
    await sessionRepository.saveSession(existingSession);
    await sessionRepository.saveSession(unrelatedSession);
    const authorizeUrl = new URL(await beginAuth("sirehshope.myshopify.com"));
    const state = requireSearchParam(authorizeUrl, "state");

    await expect(completeAuth(buildSignedCallback({ state }))).rejects.toThrow(
      "Failed to exchange authorization code for access token.",
    );

    await expect(sessionRepository.getSession(DEFAULT_TEST_SHOP)).resolves.toEqual(
      existingSession,
    );
    await expect(sessionRepository.getSession("second-shop.myshopify.com")).resolves.toEqual(
      unrelatedSession,
    );
  });

  it("deletes only the requested shop session and treats repeated deletion as safe", async () => {
    const unrelatedSession = buildSession({
      shop: "second-shop.myshopify.com",
      accessToken: "unrelated-access-token",
    });
    await sessionRepository.saveSession(buildSession());
    await sessionRepository.saveSession(unrelatedSession);

    await sessionRepository.deleteSession(DEFAULT_TEST_SHOP);
    await sessionRepository.deleteSession(DEFAULT_TEST_SHOP);

    await expect(sessionRepository.getSession(DEFAULT_TEST_SHOP)).resolves.toBeUndefined();
    await expect(sessionRepository.getSession("second-shop.myshopify.com")).resolves.toEqual(
      unrelatedSession,
    );
  });
});

describe("Shopify HMAC validation", () => {
  it("accepts a valid Shopify-compliant HMAC", () => {
    expect(validateHmac(toHmacRecord(buildSignedCallback()))).toBe(true);
  });

  it("rejects missing, invalid, malformed, and incorrectly sized HMAC values safely", () => {
    const { hmac, ...queryWithoutHmac } = buildSignedCallback();
    void hmac;

    expect(validateHmac(queryWithoutHmac as Record<string, string>)).toBe(false);
    expect(validateHmac({ ...buildSignedCallback(), hmac: "f".repeat(64) })).toBe(false);
    expect(validateHmac({ ...buildSignedCallback(), hmac: "invalid-hmac" })).toBe(false);
    expect(validateHmac({ ...buildSignedCallback(), hmac: "f".repeat(63) })).toBe(false);
    expect(validateHmac({ ...buildSignedCallback(), hmac: "f".repeat(65) })).toBe(false);
  });

  it("excludes hmac and signature while sorting callback parameters deterministically", () => {
    const query = {
      state: "test-state",
      hmac: "ignored",
      shop: DEFAULT_TEST_SHOP,
      signature: "legacy-signature",
      code: "test-code",
      timestamp: "1780000000",
    };

    expect(canonicalizeShopifyHmacMessage(query)).toBe(
      "code=test-code&shop=sirehshope.myshopify.com&state=test-state&timestamp=1780000000",
    );
  });

  it("does not mutate the input query object", () => {
    const query = buildSignedCallback({ host: "encoded-host" });
    const originalQuery = { ...query };

    validateHmac(toHmacRecord(query));

    expect(query).toEqual(originalQuery);
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
  const message = canonicalizeShopifyHmacMessage(query);

  return crypto.createHmac("sha256", shopifyConfig.apiSecret).update(message).digest("hex");
}

function toHmacRecord(query: ShopifyAuthCallbackQuery): Record<string, string> {
  return {
    shop: query.shop,
    code: query.code,
    state: query.state,
    hmac: query.hmac,
    ...(query.host === undefined ? {} : { host: query.host }),
    ...(query.timestamp === undefined ? {} : { timestamp: query.timestamp }),
  };
}

function requireSearchParam(url: URL, key: string): string {
  const value = url.searchParams.get(key);

  if (value === null) {
    throw new Error(`Missing search parameter: ${key}`);
  }

  return value;
}

function stubSuccessfulTokenExchange(
  accessToken = "test-access-token",
  scope = "read_products,write_products",
): ReturnType<typeof vi.fn> {
  const tokenExchange = vi.fn((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    void input;
    void init;

    return Promise.resolve(
      new Response(
        JSON.stringify({
          access_token: accessToken,
          scope,
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

function stubFailedTokenExchange(): ReturnType<typeof vi.fn> {
  const tokenExchange = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  vi.stubGlobal("fetch", tokenExchange);

  return tokenExchange;
}

function stubInvalidTokenExchange(): ReturnType<typeof vi.fn> {
  const tokenExchange = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ scope: "read_products" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  vi.stubGlobal("fetch", tokenExchange);

  return tokenExchange;
}

function buildSession(overrides: Partial<ShopifySession> = {}): ShopifySession {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    shop: overrides.shop ?? DEFAULT_TEST_SHOP,
    accessToken: overrides.accessToken ?? "test-access-token",
    scope: overrides.scope ?? ["read_products", "write_products"],
    apiVersion: overrides.apiVersion ?? shopifyConfig.apiVersion,
    installedAt: overrides.installedAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}
