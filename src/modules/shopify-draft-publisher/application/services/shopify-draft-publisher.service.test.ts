import { describe, expect, it } from "vitest";

import type { ShopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import type { ShopifySession } from "../../../../integrations/shopify/shopify.types.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import type { MarketingContent } from "../../../marketing-engine/domain/models/marketing-content.model.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { ShopifyDraftPublisherService } from "./shopify-draft-publisher.service.js";

const NOW = new Date("2026-07-18T10:30:00.000Z");
const SHOP = "sirehshope.myshopify.com";

class FakeShopifySessionRepository implements ShopifySessionRepository {
  public session: ShopifySession | undefined = buildSession();

  public saveSession(session: ShopifySession): Promise<ShopifySession> {
    return Promise.resolve(session);
  }

  public getSession(): Promise<ShopifySession | undefined> {
    return Promise.resolve(this.session);
  }

  public deleteSession(): Promise<void> {
    return Promise.resolve();
  }

  public hasSession(): Promise<boolean> {
    return Promise.resolve(this.session !== undefined);
  }
}

class FakeShopifyClient {
  public readonly calls: { readonly query: string; readonly variables: Readonly<Record<string, unknown>> }[] = [];
  public response: unknown = {
    productCreate: {
      product: {
        id: "gid://shopify/Product/1001",
        handle: "glow-lift-facial-wand",
        status: "DRAFT" as const,
        legacyResourceId: "1001",
      },
      userErrors: [],
    },
  };
  public error: Error | undefined;

  public graphql<TData>(query: string, variables: Readonly<Record<string, unknown>>): Promise<TData> {
    this.calls.push({ query, variables });

    if (this.error !== undefined) {
      throw this.error;
    }

    return Promise.resolve(this.response as TData);
  }
}

const buildSession = (): ShopifySession => ({
  shop: SHOP,
  accessToken: "test-token",
  scope: ["write_products"],
  apiVersion: "2026-01",
  installedAt: new Date("2026-07-18T09:00:00.000Z"),
  updatedAt: new Date("2026-07-18T09:30:00.000Z"),
});

const buildDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  id: "draft-001",
  status: "approved",
  version: 1,
  source: {
    sourceType: "manual",
    sourceId: "manual-product-001",
    importedAt: "2026-07-18T09:00:00.000Z",
  },
  title: "Supplier Glow Wand",
  description: "Supplier description for draft fallback.",
  vendor: "Lumora Beauty",
  productType: "Beauty Device",
  tags: ["Beauty", "Device"],
  targetMarkets: ["US"],
  images: [
    {
      sourceUrl: "https://images.test/glow-wand.jpg",
      altText: "Glow Lift Facial Wand",
      position: 1,
      selected: true,
      primary: true,
    },
  ],
  variants: [
    {
      id: "draft-001:variant:1",
      title: "Default",
      sku: "GLOW-001",
      options: [{ name: "Color", value: "Pearl" }],
      supplierPrice: { amount: 12.5, currency: "USD" },
      sellingPrice: { amount: 39, currency: "USD" },
      compareAtPrice: { amount: 49, currency: "USD" },
      inventoryQuantity: 8,
      available: true,
    },
  ],
  createdAt: "2026-07-18T09:00:00.000Z",
  updatedAt: "2026-07-18T09:30:00.000Z",
  ...overrides,
});

const buildMarketingContent = (overrides: Partial<MarketingContent> = {}): MarketingContent => ({
  productTitle: "Glow Lift Facial Wand",
  productDescription: "Helps busy beauty shoppers create a calmer evening routine.",
  seoTitle: "Glow Lift Facial Wand | Beauty Device",
  seoDescription: "Glow Lift Facial Wand helps beauty shoppers create a calmer routine.",
  productTags: ["beauty device", "evening routine"],
  facebookCaption: "Glow Lift Facial Wand helps keep the routine simple.",
  instagramCaption: "A calmer evening routine, made simple.",
  tiktokCaption: "A quick look at a compact beauty device.",
  emailSubject: "Glow Lift Facial Wand for calmer routines",
  emailBody: "Meet Glow Lift Facial Wand from Lumora Beauty.",
  callToAction: "Explore it today.",
  ...overrides,
});

const createService = (
  repository = new FakeShopifySessionRepository(),
  client = new FakeShopifyClient(),
): { readonly service: ShopifyDraftPublisherService; readonly repository: FakeShopifySessionRepository; readonly client: FakeShopifyClient } => ({
  service: new ShopifyDraftPublisherService(repository, () => client, undefined, () => NOW),
  repository,
  client,
});

const productVariable = (client: FakeShopifyClient): Readonly<Record<string, unknown>> => {
  const call = client.calls[0];

  if (call === undefined) {
    throw new Error("Expected Shopify GraphQL call.");
  }

  const product = call.variables.product;

  if (typeof product !== "object" || product === null) {
    throw new Error("Expected Shopify product variable.");
  }

  return product as Readonly<Record<string, unknown>>;
};

describe("ShopifyDraftPublisherService", () => {
  it("creates a Shopify draft product and returns draft references", async () => {
    const { service } = createService();

    await expect(
      service.createDraft({
        shop: SHOP,
        draft: buildDraft(),
        marketingContent: buildMarketingContent(),
      }),
    ).resolves.toEqual({
      shop: SHOP,
      productId: "gid://shopify/Product/1001",
      handle: "glow-lift-facial-wand",
      status: "DRAFT",
      adminReference: "https://sirehshope.myshopify.com/admin/products/1001",
    });
  });

  it("sends the mapped Shopify product payload with draft status", async () => {
    const { service, client } = createService();

    await service.createDraft({
      shop: SHOP,
      draft: buildDraft(),
      marketingContent: buildMarketingContent(),
      collectionIds: ["gid://shopify/Collection/2001"],
      tags: ["Launch", "beauty"],
    });

    const product = productVariable(client);
    expect(product).toMatchObject({
      title: "Glow Lift Facial Wand",
      vendor: "Lumora Beauty",
      productType: "Beauty Device",
      status: "DRAFT",
      collectionsToJoin: ["gid://shopify/Collection/2001"],
    });
    expect(product.tags).toEqual(expect.arrayContaining(["Beauty", "Device", "Launch", "Beauty Device"]));
    expect(product.variants).toEqual([
      expect.objectContaining({
        sku: "GLOW-001",
        price: "39.00",
        compareAtPrice: "49.00",
      }),
    ]);
  });

  it("rejects missing Shopify sessions before calling Shopify", async () => {
    const { service, repository, client } = createService();
    repository.session = undefined;

    await expect(
      service.createDraft({
        shop: SHOP,
        draft: buildDraft(),
        marketingContent: buildMarketingContent(),
      }),
    ).rejects.toMatchObject({
      code: "SHOPIFY_SESSION_MISSING",
      statusCode: 401,
    });
    expect(client.calls).toEqual([]);
  });

  it("translates Shopify API failures into a draft creation error", async () => {
    const { service, client } = createService();
    client.error = AppError.unauthorized("Shopify Admin API token is invalid.", undefined, "UNAUTHORIZED");

    await expect(
      service.createDraft({
        shop: SHOP,
        draft: buildDraft(),
        marketingContent: buildMarketingContent(),
      }),
    ).rejects.toMatchObject({
      code: "SHOPIFY_DRAFT_CREATE_FAILED",
      statusCode: 500,
    });
  });

  it("translates Shopify validation user errors", async () => {
    const { service, client } = createService();
    client.response = {
      productCreate: {
        product: null,
        userErrors: [{ field: ["title"], message: "Title is required." }],
      },
    };

    await expect(
      service.createDraft({
        shop: SHOP,
        draft: buildDraft(),
        marketingContent: buildMarketingContent(),
      }),
    ).rejects.toMatchObject({
      code: "SHOPIFY_DRAFT_VALIDATION_FAILED",
      statusCode: 400,
    });
  });

  it("rejects invalid drafts without calling Shopify", async () => {
    const { service, client } = createService();

    await expect(
      service.createDraft({
        shop: SHOP,
        draft: buildDraft({ variants: [] }),
        marketingContent: buildMarketingContent(),
      }),
    ).rejects.toMatchObject({
      code: "PRODUCT_DRAFT_VARIANTS_REQUIRED",
      statusCode: 400,
    });
    expect(client.calls).toEqual([]);
  });

  it("does not mutate the publish input", async () => {
    const { service } = createService();
    const input = {
      shop: SHOP,
      draft: buildDraft(),
      marketingContent: buildMarketingContent(),
      collectionIds: ["gid://shopify/Collection/2001"],
      tags: [" Launch "],
    } as const;
    const snapshot = JSON.stringify(input);

    await service.createDraft(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
