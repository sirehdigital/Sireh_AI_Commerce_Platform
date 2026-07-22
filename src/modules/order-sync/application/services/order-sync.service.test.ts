import { describe, expect, it } from "vitest";

import type { ShopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import type { ShopifySession } from "../../../../integrations/shopify/shopify.types.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import type { OrderSyncInput } from "../../domain/models/order-sync.model.js";
import { OrderSyncService } from "./order-sync.service.js";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const SHOP = "sirehshope.myshopify.com";
const ORDER_ID = "gid://shopify/Order/1001";
const LINE_ITEM_ID = "gid://shopify/LineItem/2001";

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
  public error: Error | undefined;
  public response = buildShopifyOrdersResponse();

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
  scope: ["read_orders"],
  apiVersion: "2026-01",
  installedAt: new Date("2026-07-18T09:00:00.000Z"),
  updatedAt: new Date("2026-07-18T09:30:00.000Z"),
});

const buildInput = (overrides: Partial<OrderSyncInput> = {}): OrderSyncInput => ({
  shop: SHOP,
  limit: 10,
  ...overrides,
});

const buildShopifyOrderNode = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ORDER_ID,
  name: "#1001",
  createdAt: "2026-07-18T10:15:00.000Z",
  email: "guest@example.com",
  displayFinancialStatus: "PAID",
  displayFulfillmentStatus: "UNFULFILLED",
  subtotalPriceSet: { shopMoney: { amount: "38.50", currencyCode: "USD" } },
  totalPriceSet: { shopMoney: { amount: "42.75", currencyCode: "USD" } },
  customer: {
    displayName: "Ada Lovelace",
    email: "ada@example.com",
  },
  lineItems: {
    nodes: [
      {
        id: LINE_ITEM_ID,
        title: "Velvet Glow",
        sku: "VG-001",
        quantity: 2,
        originalUnitPriceSet: { shopMoney: { amount: "19.25", currencyCode: "USD" } },
        discountedTotalSet: { shopMoney: { amount: "38.50", currencyCode: "USD" } },
      },
    ],
  },
  ...overrides,
});

const buildShopifyOrdersResponse = (overrides: Record<string, unknown> = {}): { readonly orders: Record<string, unknown> } => ({
  orders: {
    edges: [
      {
        cursor: "cursor-1",
        node: buildShopifyOrderNode(),
      },
    ],
    pageInfo: {
      hasNextPage: false,
      endCursor: "cursor-1",
    },
    ...overrides,
  },
});

const createService = (
  repository = new FakeShopifySessionRepository(),
  client = new FakeShopifyClient(),
): { readonly service: OrderSyncService; readonly repository: FakeShopifySessionRepository; readonly client: FakeShopifyClient } => ({
  service: new OrderSyncService(repository, () => client, () => NOW),
  repository,
  client,
});

describe("OrderSyncService", () => {
  it("retrieves Shopify orders", async () => {
    const { service, client } = createService();

    const result = await service.sync(buildInput());

    expect(result).toMatchObject({
      hasNextPage: false,
      syncedAt: NOW,
      orders: [
        {
          orderId: ORDER_ID,
          orderNumber: "#1001",
          customerName: "Ada Lovelace",
          customerEmail: "ada@example.com",
          currency: "USD",
          subtotal: 38.5,
          total: 42.75,
          financialStatus: "PAID",
          fulfillmentStatus: "UNFULFILLED",
          itemCount: 2,
        },
      ],
    });
    expect(client.calls).toHaveLength(1);
  });

  it("maps Shopify order data into the internal commerce model", async () => {
    const { service } = createService();

    const [order] = (await service.sync(buildInput())).orders;

    expect(order?.createdAt).toEqual(new Date("2026-07-18T10:15:00.000Z"));
    expect(order?.lineItems).toEqual([
      {
        lineItemId: LINE_ITEM_ID,
        title: "Velvet Glow",
        sku: "VG-001",
        quantity: 2,
        unitPrice: 19.25,
        totalPrice: 38.5,
      },
    ]);
  });

  it("passes pagination and status filters to Shopify", async () => {
    const { service, client } = createService();
    client.response = buildShopifyOrdersResponse({
      pageInfo: { hasNextPage: true, endCursor: "cursor-2" },
    });

    const result = await service.sync(
      buildInput({
        limit: 5,
        cursor: "cursor-1",
        financialStatus: "paid",
        fulfillmentStatus: "unfulfilled",
      }),
    );

    expect(client.calls[0]?.variables).toEqual({
      first: 5,
      after: "cursor-1",
      query: "financial_status:paid fulfillment_status:unfulfilled",
    });
    expect(result.nextCursor).toBe("cursor-2");
    expect(result.hasNextPage).toBe(true);
  });

  it("rejects missing Shopify sessions before calling Shopify", async () => {
    const { service, repository, client } = createService();
    repository.session = undefined;

    await expect(service.sync(buildInput())).rejects.toMatchObject({
      code: "SHOPIFY_SESSION_MISSING",
      statusCode: 401,
    });
    expect(client.calls).toEqual([]);
  });

  it("translates Shopify API failures", async () => {
    const { service, client } = createService();
    client.error = AppError.unauthorized("Shopify Admin API token is invalid.", undefined, "UNAUTHORIZED");

    await expect(service.sync(buildInput())).rejects.toMatchObject({
      code: "SHOPIFY_ORDER_SYNC_FAILED",
      statusCode: 500,
    });
  });

  it("rejects malformed order data", async () => {
    const { service, client } = createService();
    client.response = buildShopifyOrdersResponse({
      edges: [{ cursor: "cursor-1", node: buildShopifyOrderNode({ totalPriceSet: { shopMoney: { amount: "x", currencyCode: "USD" } } }) }],
    });

    await expect(service.sync(buildInput())).rejects.toMatchObject({
      code: "SHOPIFY_ORDER_MONEY_MALFORMED",
      statusCode: 500,
    });
  });

  it("rejects invalid query parameters", async () => {
    const { service, client } = createService();

    await expect(service.sync(buildInput({ limit: 101 }))).rejects.toMatchObject({
      code: "ORDER_SYNC_LIMIT_INVALID",
      statusCode: 400,
    });
    expect(client.calls).toEqual([]);
  });

  it("does not mutate input data", async () => {
    const { service } = createService();
    const input = buildInput({
      cursor: " cursor-1 ",
      financialStatus: "paid",
      fulfillmentStatus: "unfulfilled",
    });
    const snapshot = JSON.stringify(input);

    await service.sync(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
