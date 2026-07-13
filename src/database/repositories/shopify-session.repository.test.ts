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
  it("saves and retrieves a Shopify session", async () => {
    const repository = new PrismaShopifySessionRepository(createFakePrismaClient());
    const session = buildSession();

    await repository.saveSession(session);

    await expect(repository.getSession(TEST_SHOP)).resolves.toMatchObject({
      shop: TEST_SHOP,
      accessToken: "test-access-token",
      scope: ["read_products", "read_orders"],
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
});

function buildSession(): ShopifySession {
  return {
    shop: TEST_SHOP,
    accessToken: "test-access-token",
    scope: ["read_products", "read_orders"],
    apiVersion: "2025-01",
    installedAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function createFakePrismaClient(): ShopifySessionPrismaClient {
  const records = new Map<string, ShopifySessionRecord>();

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
