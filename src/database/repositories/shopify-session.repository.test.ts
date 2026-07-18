import { describe, expect, it } from "vitest";
import {
  PrismaShopifySessionRepository,
  type ShopifySessionDeleteManyArgs,
  type ShopifySessionDeleteManyResult,
  type ShopifySessionFindUniqueArgs,
  type ShopifySessionPrismaClient,
  type ShopifySessionRecord,
  type ShopifySessionUpsertArgs,
} from "./shopify-session.repository.js";
import type { ShopifySession, ShopifyShopDomain } from "../../integrations/shopify/shopify.types.js";

const TEST_SHOP: ShopifyShopDomain = "sirehshope.myshopify.com";

describe("PrismaShopifySessionRepository", () => {
  it("saves and retrieves a normalized Shopify session with deterministic scopes", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());
    const session = buildSession({
      shop: "SIREHSHOPE.myshopify.com",
      scope: ["write_products", "read_products", "read_products"],
    });

    await repository.saveSession(session);

    await expect(repository.getSession(TEST_SHOP)).resolves.toMatchObject({
      shop: TEST_SHOP,
      accessToken: "test-access-token",
      scope: ["read_products", "write_products"],
    });
  });

  it("persists sessions when the repository is reinitialized with the same client", async () => {
    const client = createFakePrismaClient();
    const firstRepository = new PrismaShopifySessionRepository(client);
    const secondRepository = new PrismaShopifySessionRepository(client);

    await firstRepository.saveSession(buildSession());

    await expect(secondRepository.hasSession(TEST_SHOP)).resolves.toBe(true);
  });

  it("returns undefined for missing sessions", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());

    await expect(repository.getSession(TEST_SHOP)).resolves.toBeUndefined();
  });

  it("deletes saved sessions by shop domain", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());

    await repository.saveSession(buildSession());
    await repository.deleteSession(TEST_SHOP);

    await expect(repository.hasSession(TEST_SHOP)).resolves.toBe(false);
  });

  it("keeps multiple store sessions isolated across lookup, replacement, and deletion", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());
    const firstShop = TEST_SHOP;
    const secondShop: ShopifyShopDomain = "second-shop.myshopify.com";
    const secondSession = buildSession({
      shop: secondShop,
      accessToken: "second-token",
      scope: ["read_orders"],
    });

    await repository.saveSession(buildSession({ shop: firstShop, accessToken: "first-token" }));
    await repository.saveSession(secondSession);
    await repository.saveSession(buildSession({ shop: firstShop, accessToken: "updated-first-token" }));
    await repository.deleteSession(firstShop);

    await expect(repository.getSession(firstShop)).resolves.toBeUndefined();
    await expect(repository.getSession(secondShop)).resolves.toMatchObject({
      shop: secondShop,
      accessToken: "second-token",
    });
  });

  it("rejects malformed shop lookups without falling through to another store", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());
    await repository.saveSession(buildSession());

    await expect(repository.getSession("https://sirehshope.myshopify.com")).rejects.toThrow(
      "Invalid shop domain provided.",
    );
    await expect(repository.deleteSession("sirehshope.myshopify.com/admin")).rejects.toThrow(
      "Invalid shop domain provided.",
    );
    await expect(repository.hasSession("not-shopify.example.com")).rejects.toThrow(
      "Invalid shop domain provided.",
    );
  });

  it("returns defensive copies so callers cannot mutate stored sessions", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());
    await repository.saveSession(buildSession());

    const firstRead = await repository.getSession(TEST_SHOP);
    if (firstRead === undefined) {
      throw new Error("Expected test session to exist.");
    }

    firstRead.installedAt.setUTCFullYear(2030);

    await expect(repository.getSession(TEST_SHOP)).resolves.toMatchObject({
      scope: ["read_orders", "read_products"],
      installedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  it("rejects structurally invalid, expired, and revoked stored sessions", async () => {
    const invalidTokenRepository = new PrismaShopifySessionRepository(
      createFakePrismaClient([
        {
          ...buildRecord(),
          accessToken: "",
        },
      ]),
    );
    const expiredRepository = new PrismaShopifySessionRepository(
      createFakePrismaClient([
        {
          ...buildRecord(),
          expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      ]),
    );
    const revokedRepository = new PrismaShopifySessionRepository(
      createFakePrismaClient([
        {
          ...buildRecord(),
          revokedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ]),
    );

    await expect(invalidTokenRepository.getSession(TEST_SHOP)).rejects.toThrow(
      "Stored Shopify session is invalid.",
    );
    await expect(expiredRepository.getSession(TEST_SHOP)).rejects.toThrow(
      "Shopify session has expired.",
    );
    await expect(revokedRepository.getSession(TEST_SHOP)).rejects.toThrow(
      "Shopify session has been revoked.",
    );
  });

  it("treats repeated deletion as safe and preserves unrelated sessions", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());
    const secondShop: ShopifyShopDomain = "second-shop.myshopify.com";

    await repository.saveSession(buildSession());
    await repository.saveSession(buildSession({ shop: secondShop, accessToken: "second-token" }));
    await repository.deleteSession(TEST_SHOP);
    await repository.deleteSession(TEST_SHOP);

    await expect(repository.getSession(TEST_SHOP)).resolves.toBeUndefined();
    await expect(repository.getSession(secondShop)).resolves.toMatchObject({
      shop: secondShop,
      accessToken: "second-token",
    });
  });
});

function buildSession(overrides: Partial<ShopifySession> = {}): ShopifySession {
  return {
    shop: overrides.shop ?? TEST_SHOP,
    accessToken: overrides.accessToken ?? "test-access-token",
    scope: overrides.scope ?? ["read_products", "read_orders"],
    apiVersion: overrides.apiVersion ?? "2025-01",
    installedAt: overrides.installedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    ...(overrides.expiresAt === undefined ? {} : { expiresAt: overrides.expiresAt }),
    ...(overrides.revokedAt === undefined ? {} : { revokedAt: overrides.revokedAt }),
  };
}

function buildRecord(overrides: Partial<ShopifySessionRecord> = {}): ShopifySessionRecord {
  return {
    shopDomain: overrides.shopDomain ?? TEST_SHOP,
    accessToken: overrides.accessToken ?? "test-access-token",
    scopes: overrides.scopes ?? "read_orders,read_products",
    apiVersion: overrides.apiVersion ?? "2025-01",
    installedAt: overrides.installedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    ...(overrides.expiresAt === undefined ? {} : { expiresAt: overrides.expiresAt }),
    ...(overrides.revokedAt === undefined ? {} : { revokedAt: overrides.revokedAt }),
  };
}

function createFakePrismaClient(
  initialRecords: readonly ShopifySessionRecord[] = [],
): ShopifySessionPrismaClient {
  const records = new Map<string, ShopifySessionRecord>(
    initialRecords.map((record) => [record.shopDomain, record]),
  );

  return {
    shopifySession: {
      upsert(args: ShopifySessionUpsertArgs): Promise<ShopifySessionRecord> {
        const existing = records.get(args.where.shopDomain);
        const record =
          existing === undefined
            ? args.create
            : {
                ...existing,
                ...args.update,
              };

        records.set(args.where.shopDomain, record);

        return Promise.resolve(record);
      },
      findUnique(
        args: ShopifySessionFindUniqueArgs,
      ): Promise<ShopifySessionRecord | null> {
        return Promise.resolve(records.get(args.where.shopDomain) ?? null);
      },
      deleteMany(
        args: ShopifySessionDeleteManyArgs,
      ): Promise<ShopifySessionDeleteManyResult> {
        const deleted = records.delete(args.where.shopDomain);

        return Promise.resolve({ count: deleted ? 1 : 0 });
      },
    },
  };
}
