import { describe, expect, it, vi } from "vitest";
import {
  PrismaShopifyOAuthStateRepository,
  type ShopifyOAuthStatePrismaClient,
  type ShopifyOAuthStateRecord,
} from "./shopify-oauth-state.store.js";

const TEST_STATE = "test-oauth-state";
const TEST_SHOP = "sirehshope.myshopify.com";

describe("PrismaShopifyOAuthStateRepository", () => {
  it("persists state across repository instances using the same client", async () => {
    const client = createClient();
    const firstRepository = new PrismaShopifyOAuthStateRepository(client);
    const secondRepository = new PrismaShopifyOAuthStateRepository(client);

    await firstRepository.saveOAuthState(TEST_STATE, TEST_SHOP);

    await expect(secondRepository.getOAuthState(TEST_STATE)).resolves.toMatchObject({
      shop: TEST_SHOP,
    });
  });

  it("retrieves a valid state without exposing raw state", async () => {
    const client = createClient();
    const repository = new PrismaShopifyOAuthStateRepository(client);

    await repository.saveOAuthState(TEST_STATE, TEST_SHOP);

    const stored = await repository.getOAuthState(TEST_STATE);
    expect(stored).toMatchObject({ shop: TEST_SHOP });
    expect([...client.records.keys()]).not.toContain(TEST_STATE);
  });

  it("rejects and deletes expired state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const client = createClient();
    const repository = new PrismaShopifyOAuthStateRepository(client);

    await repository.saveOAuthState(TEST_STATE, TEST_SHOP);
    vi.setSystemTime(new Date("2026-01-01T00:11:00.000Z"));

    await expect(repository.consumeOAuthState(TEST_STATE, TEST_SHOP)).rejects.toThrow(
      "Invalid state. OAuth request cannot be verified.",
    );
    await expect(repository.getOAuthState(TEST_STATE)).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("rejects shop mismatch without deleting the state", async () => {
    const repository = new PrismaShopifyOAuthStateRepository(createClient());

    await repository.saveOAuthState(TEST_STATE, TEST_SHOP);

    await expect(repository.consumeOAuthState(TEST_STATE, "othershop.myshopify.com")).rejects.toThrow(
      "Invalid state. OAuth request cannot be verified.",
    );
    await expect(repository.getOAuthState(TEST_STATE)).resolves.toBeDefined();
  });

  it("supports single-use deletion after successful validation", async () => {
    const repository = new PrismaShopifyOAuthStateRepository(createClient());

    await repository.saveOAuthState(TEST_STATE, TEST_SHOP);
    await repository.consumeOAuthState(TEST_STATE, TEST_SHOP);
    await repository.deleteOAuthState(TEST_STATE);

    await expect(repository.consumeOAuthState(TEST_STATE, TEST_SHOP)).rejects.toThrow(
      "Invalid state. OAuth request cannot be verified.",
    );
  });
});

function createClient(): ShopifyOAuthStatePrismaClient & {
  readonly records: Map<string, ShopifyOAuthStateRecord>;
} {
  const records = new Map<string, ShopifyOAuthStateRecord>();

  return {
    records,
    shopifyOAuthState: {
      upsert: (args) => {
        const existing = records.get(args.where.stateHash);
        const record = existing === undefined ? args.create : args.update;
        records.set(args.where.stateHash, record);
        return Promise.resolve(record);
      },
      findUnique: (args) => {
        return Promise.resolve(records.get(args.where.stateHash) ?? null);
      },
      deleteMany: (args) => {
        if (args.where.stateHash !== undefined) {
          const deleted = records.delete(args.where.stateHash);
          return Promise.resolve({ count: deleted ? 1 : 0 });
        }

        let count = 0;
        const expiresBefore = args.where.expiresAt?.lt;
        if (expiresBefore !== undefined) {
          for (const [stateHash, record] of records.entries()) {
            if (record.expiresAt < expiresBefore) {
              records.delete(stateHash);
              count += 1;
            }
          }
        }

        return Promise.resolve({ count });
      },
      count: () => Promise.resolve(records.size),
    },
  };
}
