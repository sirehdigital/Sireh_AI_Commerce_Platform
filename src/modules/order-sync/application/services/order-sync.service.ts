import type { ShopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import { shopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import { ShopifyClient } from "../../../../integrations/shopify/shopify.client.js";
import type {
  ShopifySession,
  ShopifyShopDomain,
} from "../../../../integrations/shopify/shopify.types.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import type {
  OrderFulfillmentStatus,
  OrderFinancialStatus,
  OrderSyncInput,
  OrderSyncLineItem,
  OrderSyncResult,
  SyncedOrder,
} from "../../domain/models/order-sync.model.js";

interface OrderSyncClient {
  graphql<TData>(query: string, variables: Readonly<Record<string, unknown>>): Promise<TData>;
}

type OrderSyncClientFactory = (session: ShopifySession) => OrderSyncClient;

type NormalizedOrderSyncInput = Required<Pick<OrderSyncInput, "limit">> &
  Omit<OrderSyncInput, "shop" | "limit"> & {
    readonly shop: ShopifyShopDomain;
  };

interface ShopifyMoneySet {
  readonly shopMoney?: {
    readonly amount?: string | null;
    readonly currencyCode?: string | null;
  } | null;
}

interface ShopifyOrderLineItemNode {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly sku?: string | null;
  readonly quantity?: number | null;
  readonly originalUnitPriceSet?: ShopifyMoneySet | null;
  readonly discountedTotalSet?: ShopifyMoneySet | null;
}

interface ShopifyOrderNode {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly createdAt?: string | null;
  readonly displayFinancialStatus?: string | null;
  readonly displayFulfillmentStatus?: string | null;
  readonly subtotalPriceSet?: ShopifyMoneySet | null;
  readonly totalPriceSet?: ShopifyMoneySet | null;
  readonly customer?: {
    readonly displayName?: string | null;
    readonly email?: string | null;
  } | null;
  readonly email?: string | null;
  readonly lineItems?: {
    readonly nodes?: readonly ShopifyOrderLineItemNode[] | null;
  } | null;
}

interface ShopifyOrdersResponse {
  readonly orders: {
    readonly edges: readonly {
      readonly cursor: string;
      readonly node: ShopifyOrderNode;
    }[];
    readonly pageInfo: {
      readonly hasNextPage: boolean;
      readonly endCursor?: string | null;
    };
  } | null;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const FINANCIAL_STATUSES: ReadonlySet<OrderFinancialStatus> = new Set([
  "authorized",
  "paid",
  "partially_paid",
  "partially_refunded",
  "pending",
  "refunded",
  "voided",
]);
const FULFILLMENT_STATUSES: ReadonlySet<OrderFulfillmentStatus> = new Set([
  "fulfilled",
  "in_progress",
  "on_hold",
  "open",
  "partially_fulfilled",
  "pending_fulfillment",
  "request_declined",
  "restocked",
  "scheduled",
  "unfulfilled",
]);

const ORDERS_QUERY = `
query SirehOrderSync($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
    edges {
      cursor
      node {
        id
        name
        createdAt
        email
        displayFinancialStatus
        displayFulfillmentStatus
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          displayName
          email
        }
        lineItems(first: 100) {
          nodes {
            id
            title
            sku
            quantity
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            discountedTotalSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

export class OrderSyncService {
  public constructor(
    private readonly sessionRepository: ShopifySessionRepository = shopifySessionRepository,
    private readonly clientFactory: OrderSyncClientFactory = (session) =>
      new ShopifyClient({
        shop: session.shop,
        accessToken: session.accessToken,
        apiVersion: session.apiVersion,
      }),
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async sync(input: OrderSyncInput): Promise<OrderSyncResult> {
    const normalizedInput = this.validateInput(input);
    const session = await this.requireActiveSession(normalizedInput.shop);
    const client = this.clientFactory(session);
    const response = await this.fetchOrders(client, normalizedInput, session.shop);

    if (response.orders === null) {
      throw AppError.internal("Shopify order sync response did not include orders.", undefined, "SHOPIFY_ORDER_SYNC_EMPTY_RESPONSE");
    }

    const orders = response.orders.edges.map((edge) => this.mapOrder(edge.node));
    const endCursor = response.orders.pageInfo.endCursor ?? response.orders.edges.at(-1)?.cursor;

    return {
      orders,
      ...(endCursor === undefined || !response.orders.pageInfo.hasNextPage ? {} : { nextCursor: endCursor }),
      hasNextPage: response.orders.pageInfo.hasNextPage,
      syncedAt: this.now(),
    };
  }

  private validateInput(input: OrderSyncInput): NormalizedOrderSyncInput {
    const shop = this.normalizeShop(input.shop);
    const limit = input.limit ?? DEFAULT_LIMIT;

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw AppError.badRequest("Order sync limit must be an integer between 1 and 100.", { limit }, "ORDER_SYNC_LIMIT_INVALID");
    }

    if (input.cursor?.trim().length === 0) {
      throw AppError.badRequest("Order sync cursor must be non-empty when supplied.", undefined, "ORDER_SYNC_CURSOR_INVALID");
    }

    if (input.financialStatus !== undefined && !FINANCIAL_STATUSES.has(input.financialStatus)) {
      throw AppError.badRequest(
        "Order financial status filter is unsupported.",
        { financialStatus: input.financialStatus },
        "ORDER_SYNC_FINANCIAL_STATUS_INVALID",
      );
    }

    if (input.fulfillmentStatus !== undefined && !FULFILLMENT_STATUSES.has(input.fulfillmentStatus)) {
      throw AppError.badRequest(
        "Order fulfillment status filter is unsupported.",
        { fulfillmentStatus: input.fulfillmentStatus },
        "ORDER_SYNC_FULFILLMENT_STATUS_INVALID",
      );
    }

    return {
      shop,
      limit,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor.trim() }),
      ...(input.financialStatus === undefined ? {} : { financialStatus: input.financialStatus }),
      ...(input.fulfillmentStatus === undefined ? {} : { fulfillmentStatus: input.fulfillmentStatus }),
    };
  }

  private async requireActiveSession(shop: ShopifyShopDomain): Promise<ShopifySession> {
    const session = await this.sessionRepository.getSession(shop);

    if (session === undefined) {
      throw AppError.unauthorized(
        `No active Shopify session found for shop: ${shop}.`,
        { shop },
        "SHOPIFY_SESSION_MISSING",
      );
    }

    if (session.revokedAt !== undefined) {
      throw AppError.unauthorized("Shopify session has been revoked.", { shop }, "SHOPIFY_SESSION_REVOKED");
    }

    if (session.expiresAt !== undefined && session.expiresAt.getTime() <= this.now().getTime()) {
      throw AppError.unauthorized("Shopify session has expired.", { shop }, "SHOPIFY_SESSION_EXPIRED");
    }

    return {
      ...session,
      scope: [...session.scope],
      installedAt: new Date(session.installedAt),
      updatedAt: new Date(session.updatedAt),
      ...(session.expiresAt === undefined ? {} : { expiresAt: new Date(session.expiresAt) }),
      ...(session.revokedAt === undefined ? {} : { revokedAt: new Date(session.revokedAt) }),
    };
  }

  private async fetchOrders(
    client: OrderSyncClient,
    input: NormalizedOrderSyncInput,
    shop: ShopifyShopDomain,
  ): Promise<ShopifyOrdersResponse> {
    try {
      return await client.graphql<ShopifyOrdersResponse>(ORDERS_QUERY, {
        first: input.limit,
        ...(input.cursor === undefined ? {} : { after: input.cursor }),
        query: this.buildQuery(input),
      });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw AppError.internal(
          "Shopify order sync failed.",
          { shop, upstreamCode: error.code, upstreamStatusCode: error.statusCode },
          "SHOPIFY_ORDER_SYNC_FAILED",
        );
      }

      throw AppError.internal("Shopify order sync failed.", { shop }, "SHOPIFY_ORDER_SYNC_FAILED");
    }
  }

  private buildQuery(input: Omit<OrderSyncInput, "shop">): string | null {
    const filters = [
      input.financialStatus === undefined ? undefined : `financial_status:${input.financialStatus}`,
      input.fulfillmentStatus === undefined ? undefined : `fulfillment_status:${input.fulfillmentStatus}`,
    ].filter((filter): filter is string => filter !== undefined);

    return filters.length === 0 ? null : filters.join(" ");
  }

  private mapOrder(order: ShopifyOrderNode): SyncedOrder {
    const orderId = this.requireText(order.id, "Shopify order is missing an ID.", "SHOPIFY_ORDER_ID_MALFORMED");
    const orderNumber = this.requireText(order.name, "Shopify order is missing an order number.", "SHOPIFY_ORDER_NUMBER_MALFORMED");
    const createdAt = this.parseDate(order.createdAt, orderId);
    const totalMoney = this.requireMoney(order.totalPriceSet, orderId, "total");
    const subtotalMoney = this.requireMoney(order.subtotalPriceSet, orderId, "subtotal");
    const lineItems = this.mapLineItems(order.lineItems?.nodes, orderId);

    if (subtotalMoney.currency !== totalMoney.currency) {
      throw AppError.internal(
        "Shopify order currencies are inconsistent.",
        { orderId, subtotalCurrency: subtotalMoney.currency, totalCurrency: totalMoney.currency },
        "SHOPIFY_ORDER_CURRENCY_MISMATCH",
      );
    }

    return {
      orderId,
      orderNumber,
      createdAt,
      customerName: this.optionalText(order.customer?.displayName) ?? "Guest customer",
      customerEmail: this.optionalText(order.customer?.email) ?? this.optionalText(order.email) ?? "",
      currency: totalMoney.currency,
      subtotal: subtotalMoney.amount,
      total: totalMoney.amount,
      financialStatus: this.requireText(
        order.displayFinancialStatus,
        "Shopify order is missing a financial status.",
        "SHOPIFY_ORDER_FINANCIAL_STATUS_MALFORMED",
      ),
      fulfillmentStatus: this.requireText(
        order.displayFulfillmentStatus,
        "Shopify order is missing a fulfillment status.",
        "SHOPIFY_ORDER_FULFILLMENT_STATUS_MALFORMED",
      ),
      lineItems,
      itemCount: lineItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  private mapLineItems(nodes: readonly ShopifyOrderLineItemNode[] | null | undefined, orderId: string): readonly OrderSyncLineItem[] {
    if (nodes === null || nodes === undefined) {
      throw AppError.internal("Shopify order is missing line items.", { orderId }, "SHOPIFY_ORDER_LINE_ITEMS_MALFORMED");
    }

    return nodes.map((item) => {
      const lineItemId = this.requireText(item.id, "Shopify order line item is missing an ID.", "SHOPIFY_ORDER_LINE_ITEM_ID_MALFORMED");
      const quantity = item.quantity;

      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) {
        throw AppError.internal(
          "Shopify order line item quantity is malformed.",
          { orderId, lineItemId, quantity },
          "SHOPIFY_ORDER_LINE_ITEM_QUANTITY_MALFORMED",
        );
      }

      const validQuantity = quantity;

      return {
        lineItemId,
        title: this.requireText(item.title, "Shopify order line item is missing a title.", "SHOPIFY_ORDER_LINE_ITEM_TITLE_MALFORMED"),
        ...(item.sku === null || item.sku === undefined || item.sku.trim().length === 0 ? {} : { sku: item.sku.trim() }),
        quantity: validQuantity,
        unitPrice: this.requireMoney(item.originalUnitPriceSet, orderId, "line item unit price").amount,
        totalPrice: this.requireMoney(item.discountedTotalSet, orderId, "line item total").amount,
      };
    });
  }

  private requireMoney(moneySet: ShopifyMoneySet | null | undefined, orderId: string, label: string): { readonly amount: number; readonly currency: string } {
    const amountValue = moneySet?.shopMoney?.amount;
    const currencyValue = moneySet?.shopMoney?.currencyCode;
    const amount = amountValue === null || amountValue === undefined ? Number.NaN : Number.parseFloat(amountValue);
    const currency = currencyValue?.trim().toUpperCase();

    if (!Number.isFinite(amount) || amount < 0 || currency === undefined || !/^[A-Z]{3}$/u.test(currency)) {
      throw AppError.internal(
        `Shopify order ${label} money is malformed.`,
        { orderId, amount: amountValue, currency: currencyValue },
        "SHOPIFY_ORDER_MONEY_MALFORMED",
      );
    }

    return { amount: this.roundMoney(amount), currency };
  }

  private parseDate(value: string | null | undefined, orderId: string): Date {
    const timestamp = value === null || value === undefined ? Number.NaN : Date.parse(value);

    if (!Number.isFinite(timestamp)) {
      throw AppError.internal(
        "Shopify order created date is malformed.",
        { orderId, createdAt: value },
        "SHOPIFY_ORDER_CREATED_AT_MALFORMED",
      );
    }

    return new Date(timestamp);
  }

  private requireText(value: string | null | undefined, message: string, code: string): string {
    const normalized = value?.trim();

    if (normalized === undefined || normalized.length === 0) {
      throw AppError.internal(message, undefined, code);
    }

    return normalized;
  }

  private optionalText(value: string | null | undefined): string | undefined {
    const normalized = value?.trim();

    return normalized === undefined || normalized.length === 0 ? undefined : normalized;
  }

  private normalizeShop(shop: string): ShopifyShopDomain {
    const normalized = shop.trim().toLowerCase();

    if (normalized.length === 0 || !normalized.endsWith(".myshopify.com")) {
      throw AppError.badRequest("Invalid Shopify shop domain.", { shop }, "SHOP_DOMAIN_INVALID");
    }

    return normalized as ShopifyShopDomain;
  }

  private roundMoney(value: number): number {
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }
}
