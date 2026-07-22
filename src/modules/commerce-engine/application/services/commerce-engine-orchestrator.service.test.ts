import { describe, expect, it } from "vitest";

import type { ShopifyShopDomain } from "../../../../integrations/shopify/shopify.types.js";
import type { InventoryPricingSyncResult } from "../../../inventory-pricing-sync/domain/models/inventory-pricing-sync.model.js";
import type { MarketingContent, MarketingContentInput } from "../../../marketing-engine/domain/models/marketing-content.model.js";
import type { OrderSyncResult } from "../../../order-sync/domain/models/order-sync.model.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { ProductCandidate, ScoredProductCandidate } from "../../../product-hunter/domain/models/product-candidate.model.js";
import type { ShopifyDraftPublishResult } from "../../../shopify-draft-publisher/domain/models/shopify-draft-publisher.model.js";
import { CommerceEngineOrchestratorService, type CommerceEngineInput } from "./commerce-engine-orchestrator.service.js";

const SHOP = "sirehshope.myshopify.com" as ShopifyShopDomain;
const PRODUCT_ID = "gid://shopify/Product/1001";
const VARIANT_ID = "gid://shopify/ProductVariant/2001";

class FakeProductHunter {
  public error: Error | undefined;
  public calls = 0;

  public rank(): readonly ScoredProductCandidate[] {
    this.calls += 1;

    if (this.error !== undefined) {
      throw this.error;
    }

    return [buildRankedProduct()];
  }
}

class FakeMarketingEngine {
  public error: Error | undefined;
  public inputs: MarketingContentInput[] = [];

  public generate(input: MarketingContentInput): MarketingContent {
    this.inputs.push(input);

    if (this.error !== undefined) {
      throw this.error;
    }

    return buildMarketingContent(input.productTitle);
  }
}

class FakeDraftPublisher {
  public error: Error | undefined;
  public calls = 0;

  public createDraft(): Promise<ShopifyDraftPublishResult> {
    this.calls += 1;

    if (this.error !== undefined) {
      throw this.error;
    }

    return Promise.resolve({
      shop: SHOP,
      productId: PRODUCT_ID,
      handle: "velvet-glow",
      status: "DRAFT",
    });
  }
}

class FakeInventorySync {
  public error: Error | undefined;
  public inputs: unknown[] = [];

  public sync(input: unknown): Promise<InventoryPricingSyncResult> {
    this.inputs.push(input);

    if (this.error !== undefined) {
      throw this.error;
    }

    return Promise.resolve(buildPricingSync());
  }
}

class FakeOrderSync {
  public error: Error | undefined;
  public calls = 0;

  public sync(): Promise<OrderSyncResult> {
    this.calls += 1;

    if (this.error !== undefined) {
      throw this.error;
    }

    return Promise.resolve(buildOrderSyncResult());
  }
}

const buildCandidate = (): ProductCandidate => ({
  source: "manual",
  sourceProductId: "candidate-1",
  title: "Velvet Glow",
  productUrl: "https://supplier.example/products/velvet-glow",
  imageUrl: "https://supplier.example/products/velvet-glow.jpg",
  supplierPrice: 12,
  shippingCost: 3,
  suggestedSellingPrice: 34,
  currency: "USD",
  estimatedDeliveryDays: 7,
  supplierRating: 4.8,
  salesOrOrders: 1400,
  reviewCount: 320,
  trendScore: 84,
  competitionScore: 30,
});

const buildRankedProduct = (): ScoredProductCandidate => ({
  candidate: buildCandidate(),
  financials: {
    supplierPrice: { amount: 12, currency: "USD" },
    shippingCost: { amount: 3, currency: "USD" },
    suggestedSellingPrice: { amount: 34, currency: "USD" },
    totalCost: { amount: 15, currency: "USD" },
    estimatedProfit: { amount: 19, currency: "USD" },
    profitMarginPercentage: 55.88,
  },
  scoreBreakdown: {
    profitMargin: 90,
    salesDemand: 86,
    supplierRating: 96,
    deliverySpeed: 82,
    trendStrength: 84,
    competitionOpportunity: 70,
  },
  winningScore: 87,
});

const buildMarketingContent = (title: string): MarketingContent => ({
  productTitle: title,
  productDescription: `${title} helps customers simplify daily care.`,
  seoTitle: `${title} | Beauty`,
  seoDescription: `${title} for practical beauty routines.`,
  productTags: ["beauty", "daily care"],
  facebookCaption: `${title} for daily care.`,
  instagramCaption: `${title}: simple daily care.`,
  tiktokCaption: `A quick look at ${title}.`,
  emailSubject: `${title} for daily care`,
  emailBody: `Meet ${title}.`,
  callToAction: "Explore it today.",
});

const buildProductDraft = (): ProductDraft => ({
  id: "draft-1",
  status: "draft",
  version: 1,
  source: {
    sourceType: "manual",
    sourceId: "candidate-1",
    importedAt: "2026-07-18T10:00:00.000Z",
  },
  title: "Velvet Glow",
  description: "A practical beauty product.",
  tags: ["beauty"],
  targetMarkets: ["US"],
  images: [
    {
      sourceUrl: "https://supplier.example/products/velvet-glow.jpg",
      position: 1,
      selected: true,
      primary: true,
    },
  ],
  variants: [
    {
      id: "variant-1",
      title: "Default",
      options: [{ name: "Title", value: "Default" }],
      supplierPrice: { amount: 12, currency: "USD" },
      sellingPrice: { amount: 34, currency: "USD" },
      inventoryQuantity: 12,
      available: true,
    },
  ],
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T10:00:00.000Z",
});

const buildPricingSync = (): InventoryPricingSyncResult => ({
  shop: SHOP,
  productId: PRODUCT_ID,
  variantId: VARIANT_ID,
  price: { amount: 30, currency: "USD" },
  quantity: 12,
  pricing: {
    supplierPrice: { amount: 12, currency: "USD" },
    shippingCost: { amount: 3, currency: "USD" },
    suggestedSellingPrice: { amount: 30, currency: "USD" },
    totalCost: { amount: 15, currency: "USD" },
    estimatedProfit: { amount: 15, currency: "USD" },
    profitMarginPercentage: 50,
    finalSellingPrice: { amount: 30, currency: "USD" },
    targetMarginPercentage: 50,
  },
  status: "SYNCED",
});

const buildOrderSyncResult = (): OrderSyncResult => ({
  orders: [
    {
      orderId: "gid://shopify/Order/3001",
      orderNumber: "#1001",
      createdAt: new Date("2026-07-18T11:00:00.000Z"),
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      currency: "USD",
      subtotal: 30,
      total: 30,
      financialStatus: "PAID",
      fulfillmentStatus: "UNFULFILLED",
      lineItems: [
        {
          lineItemId: "gid://shopify/LineItem/4001",
          title: "Velvet Glow",
          quantity: 1,
          unitPrice: 30,
          totalPrice: 30,
        },
      ],
      itemCount: 1,
    },
  ],
  hasNextPage: false,
  syncedAt: new Date("2026-07-18T12:00:00.000Z"),
});

const buildInput = (): CommerceEngineInput => ({
  shop: SHOP,
  productCandidates: [buildCandidate()],
  marketingContext: {
    category: "Beauty",
    keyBenefits: ["simple daily care"],
    features: ["lightweight design"],
    targetAudience: "busy skincare buyers",
    brandName: "Sireh",
    targetMarket: "US",
    keywords: ["beauty"],
    tone: "friendly",
  },
  productDraft: buildProductDraft(),
  inventoryContext: {
    shopifyVariantId: VARIANT_ID,
    currentInventoryQuantity: 12,
    targetMarginPercentage: 50,
  },
  orderQuery: {
    limit: 10,
    financialStatus: "paid",
  },
});

const createService = (): {
  readonly service: CommerceEngineOrchestratorService;
  readonly productHunter: FakeProductHunter;
  readonly marketingEngine: FakeMarketingEngine;
  readonly draftPublisher: FakeDraftPublisher;
  readonly inventorySync: FakeInventorySync;
  readonly orderSync: FakeOrderSync;
} => {
  const productHunter = new FakeProductHunter();
  const marketingEngine = new FakeMarketingEngine();
  const draftPublisher = new FakeDraftPublisher();
  const inventorySync = new FakeInventorySync();
  const orderSync = new FakeOrderSync();

  return {
    service: new CommerceEngineOrchestratorService(productHunter, marketingEngine, draftPublisher, inventorySync, orderSync),
    productHunter,
    marketingEngine,
    draftPublisher,
    inventorySync,
    orderSync,
  };
};

describe("CommerceEngineOrchestratorService", () => {
  it("executes the complete successful workflow", async () => {
    const { service } = createService();

    await expect(service.execute(buildInput())).resolves.toMatchObject({
      rankedProduct: { winningScore: 87 },
      marketingContent: { productTitle: "Velvet Glow" },
      draftProduct: { productId: PRODUCT_ID, status: "DRAFT" },
      pricingSync: { productId: PRODUCT_ID, variantId: VARIANT_ID, status: "SYNCED" },
      syncedOrders: { hasNextPage: false },
      completedSteps: [
        "PRODUCT_HUNTER",
        "MARKETING_ENGINE",
        "SHOPIFY_DRAFT_PUBLISHER",
        "INVENTORY_PRICING_SYNC",
        "ORDER_SYNC",
      ],
      executionStatus: "COMPLETED",
    });
  });

  it("stops immediately on Product Hunter failure", async () => {
    const workflow = createService();
    workflow.productHunter.error = new Error("Product Hunter failed.");

    await expect(workflow.service.execute(buildInput())).rejects.toThrow("Product Hunter failed.");
    expect(workflow.marketingEngine.inputs).toEqual([]);
  });

  it("stops immediately on Marketing failure", async () => {
    const workflow = createService();
    workflow.marketingEngine.error = new Error("Marketing failed.");

    await expect(workflow.service.execute(buildInput())).rejects.toThrow("Marketing failed.");
    expect(workflow.draftPublisher.calls).toBe(0);
  });

  it("stops immediately on Draft publish failure", async () => {
    const workflow = createService();
    workflow.draftPublisher.error = new Error("Draft publish failed.");

    await expect(workflow.service.execute(buildInput())).rejects.toThrow("Draft publish failed.");
    expect(workflow.inventorySync.inputs).toEqual([]);
  });

  it("stops immediately on Inventory sync failure", async () => {
    const workflow = createService();
    workflow.inventorySync.error = new Error("Inventory sync failed.");

    await expect(workflow.service.execute(buildInput())).rejects.toThrow("Inventory sync failed.");
    expect(workflow.orderSync.calls).toBe(0);
  });

  it("stops immediately on Order sync failure", async () => {
    const workflow = createService();
    workflow.orderSync.error = new Error("Order sync failed.");

    await expect(workflow.service.execute(buildInput())).rejects.toThrow("Order sync failed.");
  });

  it("preserves workflow input immutability", async () => {
    const { service } = createService();
    const input = buildInput();
    const snapshot = JSON.stringify(input);

    await service.execute(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
