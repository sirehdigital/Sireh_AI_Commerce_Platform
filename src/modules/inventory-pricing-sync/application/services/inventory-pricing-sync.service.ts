import type { ShopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import { shopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import { ShopifyClient } from "../../../../integrations/shopify/shopify.client.js";
import type {
  ShopifySession,
  ShopifyShopDomain,
} from "../../../../integrations/shopify/shopify.types.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import type {
  InventoryPricingSyncInput,
  InventoryPricingSyncPricing,
  InventoryPricingSyncResult,
} from "../../domain/models/inventory-pricing-sync.model.js";

interface InventoryPricingSyncClient {
  graphql<TData>(query: string, variables: Readonly<Record<string, unknown>>): Promise<TData>;
}

type InventoryPricingSyncClientFactory = (session: ShopifySession) => InventoryPricingSyncClient;

interface GraphqlUserError {
  readonly field: readonly string[] | null;
  readonly message: string;
}

interface VariantInventoryLookupResponse {
  readonly productVariant: {
    readonly id: string;
    readonly inventoryItem: {
      readonly id: string;
      readonly inventoryLevels: {
        readonly nodes: readonly {
          readonly id: string;
          readonly location: {
            readonly id: string;
          };
        }[];
      };
    } | null;
  } | null;
}

interface VariantPriceUpdateResponse {
  readonly productVariantsBulkUpdate: {
    readonly product: { readonly id: string } | null;
    readonly productVariants: readonly { readonly id: string; readonly price: string }[] | null;
    readonly userErrors: readonly GraphqlUserError[];
  };
}

interface InventorySetQuantitiesResponse {
  readonly inventorySetQuantities: {
    readonly inventoryAdjustmentGroup: { readonly id: string } | null;
    readonly userErrors: readonly GraphqlUserError[];
  };
}

const PRODUCT_ID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/u;
const VARIANT_ID_PATTERN = /^gid:\/\/shopify\/ProductVariant\/\d+$/u;
const DEFAULT_TARGET_MARGIN_PERCENTAGE = 40;

const VARIANT_INVENTORY_LOOKUP_QUERY = `
query VariantInventoryForSync($variantId: ID!) {
  productVariant(id: $variantId) {
    id
    inventoryItem {
      id
      inventoryLevels(first: 1) {
        nodes {
          id
          location {
            id
          }
        }
      }
    }
  }
}
`;

const UPDATE_VARIANT_PRICE_MUTATION = `
mutation UpdateVariantPriceForSync($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) {
    product {
      id
    }
    productVariants {
      id
      price
    }
    userErrors {
      field
      message
    }
  }
}
`;

const SET_INVENTORY_QUANTITY_MUTATION = `
mutation SetInventoryQuantityForSync($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    inventoryAdjustmentGroup {
      id
    }
    userErrors {
      field
      message
    }
  }
}
`;

export class InventoryPricingSyncService {
  public constructor(
    private readonly sessionRepository: ShopifySessionRepository = shopifySessionRepository,
    private readonly clientFactory: InventoryPricingSyncClientFactory = (session) =>
      new ShopifyClient({
        shop: session.shop,
        accessToken: session.accessToken,
        apiVersion: session.apiVersion,
      }),
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async sync(input: InventoryPricingSyncInput): Promise<InventoryPricingSyncResult> {
    const normalizedInput = this.validateInput(input);
    const pricing = this.calculatePricing(normalizedInput);
    const session = await this.requireActiveSession(normalizedInput.shop);
    const client = this.clientFactory(session);
    const inventoryTarget = await this.loadInventoryTarget(client, normalizedInput.shopifyVariantId, session.shop);

    await this.updateVariantPrice(client, normalizedInput, pricing, session.shop);
    await this.updateInventoryQuantity(client, inventoryTarget, normalizedInput.currentInventoryQuantity, session.shop);

    return {
      shop: session.shop,
      productId: normalizedInput.shopifyProductId,
      variantId: normalizedInput.shopifyVariantId,
      price: pricing.finalSellingPrice,
      quantity: normalizedInput.currentInventoryQuantity,
      pricing,
      status: "SYNCED",
    };
  }

  private validateInput(input: InventoryPricingSyncInput): InventoryPricingSyncInput {
    const shop = this.normalizeShop(input.shop);
    this.assertPattern(input.shopifyProductId, PRODUCT_ID_PATTERN, "Invalid Shopify product ID.", "SHOPIFY_PRODUCT_ID_INVALID");
    this.assertPattern(input.shopifyVariantId, VARIANT_ID_PATTERN, "Invalid Shopify variant ID.", "SHOPIFY_VARIANT_ID_INVALID");
    this.assertMoney(input.supplierPrice, "Supplier price must be finite and non-negative.", "SUPPLIER_PRICE_INVALID");
    this.assertMoney(input.shippingCost, "Shipping cost must be finite and non-negative.", "SHIPPING_COST_INVALID");
    this.assertInventoryQuantity(input.currentInventoryQuantity);
    this.assertCurrency(input.currency);

    if (input.fixedSellingPrice !== undefined) {
      this.assertPositiveMoney(
        input.fixedSellingPrice,
        "Fixed selling price must be finite and greater than zero.",
        "FIXED_SELLING_PRICE_INVALID",
      );
    }

    if (input.targetMarginPercentage !== undefined) {
      this.assertTargetMargin(input.targetMarginPercentage);
    }

    return {
      shop,
      shopifyProductId: input.shopifyProductId.trim(),
      shopifyVariantId: input.shopifyVariantId.trim(),
      supplierPrice: this.roundMoney(input.supplierPrice),
      shippingCost: this.roundMoney(input.shippingCost),
      currentInventoryQuantity: input.currentInventoryQuantity,
      ...(input.targetMarginPercentage === undefined
        ? {}
        : { targetMarginPercentage: this.roundPercentage(input.targetMarginPercentage) }),
      ...(input.fixedSellingPrice === undefined ? {} : { fixedSellingPrice: this.roundMoney(input.fixedSellingPrice) }),
      currency: input.currency.trim().toUpperCase(),
    };
  }

  private calculatePricing(input: InventoryPricingSyncInput): InventoryPricingSyncPricing {
    const totalCost = this.roundMoney(input.supplierPrice + input.shippingCost);
    const targetMarginPercentage = input.targetMarginPercentage ?? DEFAULT_TARGET_MARGIN_PERCENTAGE;
    const finalSellingPrice = this.roundMoney(
      input.fixedSellingPrice ?? totalCost / (1 - targetMarginPercentage / 100),
    );
    const estimatedProfit = this.roundMoney(finalSellingPrice - totalCost);

    if (totalCost <= 0) {
      throw AppError.badRequest("Total supplier cost must be greater than zero.", { totalCost }, "TOTAL_COST_INVALID");
    }

    if (estimatedProfit <= 0) {
      throw AppError.badRequest(
        "Final selling price must be profitable after supplier and shipping cost.",
        { totalCost, finalSellingPrice },
        "SELLING_PRICE_NOT_PROFITABLE",
      );
    }

    return {
      supplierPrice: { amount: input.supplierPrice, currency: input.currency },
      shippingCost: { amount: input.shippingCost, currency: input.currency },
      suggestedSellingPrice: { amount: finalSellingPrice, currency: input.currency },
      totalCost: { amount: totalCost, currency: input.currency },
      estimatedProfit: { amount: estimatedProfit, currency: input.currency },
      profitMarginPercentage: this.roundPercentage((estimatedProfit / finalSellingPrice) * 100),
      finalSellingPrice: { amount: finalSellingPrice, currency: input.currency },
      targetMarginPercentage,
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

  private async loadInventoryTarget(
    client: InventoryPricingSyncClient,
    variantId: string,
    shop: ShopifyShopDomain,
  ): Promise<{ readonly inventoryItemId: string; readonly locationId: string }> {
    try {
      const response = await client.graphql<VariantInventoryLookupResponse>(VARIANT_INVENTORY_LOOKUP_QUERY, {
        variantId,
      });
      const inventoryItemId = response.productVariant?.inventoryItem?.id;
      const locationId = response.productVariant?.inventoryItem?.inventoryLevels.nodes[0]?.location.id;

      if (response.productVariant?.id !== variantId || inventoryItemId === undefined || locationId === undefined) {
        throw AppError.conflict(
          "Shopify variant inventory target could not be resolved.",
          { variantId },
          "SHOPIFY_INVENTORY_TARGET_MISSING",
        );
      }

      return { inventoryItemId, locationId };
    } catch (error: unknown) {
      throw this.translateShopifyError(error, shop, "Shopify inventory target lookup failed.");
    }
  }

  private async updateVariantPrice(
    client: InventoryPricingSyncClient,
    input: InventoryPricingSyncInput,
    pricing: InventoryPricingSyncPricing,
    shop: ShopifyShopDomain,
  ): Promise<void> {
    try {
      const response = await client.graphql<VariantPriceUpdateResponse>(UPDATE_VARIANT_PRICE_MUTATION, {
        productId: input.shopifyProductId,
        variants: [
          {
            id: input.shopifyVariantId,
            price: this.formatMoney(pricing.finalSellingPrice.amount),
          },
        ],
      });

      this.assertNoUserErrors("price update", response.productVariantsBulkUpdate.userErrors);

      if (response.productVariantsBulkUpdate.product?.id !== input.shopifyProductId) {
        throw AppError.conflict(
          "Shopify price update did not confirm the requested product ID.",
          { productId: input.shopifyProductId },
          "SHOPIFY_SYNC_PRICE_PRODUCT_MISMATCH",
        );
      }

      const updatedVariant = response.productVariantsBulkUpdate.productVariants?.find(
        (variant) => variant.id === input.shopifyVariantId,
      );

      if (updatedVariant === undefined) {
        throw AppError.conflict(
          "Shopify price update did not confirm the requested variant ID.",
          { variantId: input.shopifyVariantId },
          "SHOPIFY_SYNC_PRICE_VARIANT_MISSING",
        );
      }
    } catch (error: unknown) {
      throw this.translateShopifyError(error, shop, "Shopify variant price update failed.");
    }
  }

  private async updateInventoryQuantity(
    client: InventoryPricingSyncClient,
    inventoryTarget: { readonly inventoryItemId: string; readonly locationId: string },
    quantity: number,
    shop: ShopifyShopDomain,
  ): Promise<void> {
    try {
      const response = await client.graphql<InventorySetQuantitiesResponse>(SET_INVENTORY_QUANTITY_MUTATION, {
        input: {
          name: "available",
          reason: "correction",
          quantities: [
            {
              inventoryItemId: inventoryTarget.inventoryItemId,
              locationId: inventoryTarget.locationId,
              quantity,
            },
          ],
        },
      });

      this.assertNoUserErrors("inventory update", response.inventorySetQuantities.userErrors);

      if (response.inventorySetQuantities.inventoryAdjustmentGroup === null) {
        throw AppError.conflict(
          "Shopify inventory update did not return an adjustment group.",
          undefined,
          "SHOPIFY_SYNC_INVENTORY_EMPTY_RESPONSE",
        );
      }
    } catch (error: unknown) {
      throw this.translateShopifyError(error, shop, "Shopify inventory quantity update failed.");
    }
  }

  private assertNoUserErrors(stage: string, errors: readonly GraphqlUserError[]): void {
    if (errors.length === 0) {
      return;
    }

    throw AppError.badRequest(
      `Shopify ${stage} returned validation errors.`,
      {
        stage,
        errors: errors.map((error) => ({
          field: error.field,
          message: error.message,
        })),
      },
      "SHOPIFY_SYNC_VALIDATION_FAILED",
    );
  }

  private translateShopifyError(error: unknown, shop: ShopifyShopDomain, message: string): AppError {
    if (error instanceof AppError && error.code === "SHOPIFY_SYNC_VALIDATION_FAILED") {
      return error;
    }

    if (error instanceof AppError && error.code.startsWith("SHOPIFY_SYNC_")) {
      return error;
    }

    if (error instanceof AppError) {
      return AppError.internal(
        message,
        { shop, upstreamCode: error.code, upstreamStatusCode: error.statusCode },
        "SHOPIFY_SYNC_FAILED",
      );
    }

    return AppError.internal(message, { shop }, "SHOPIFY_SYNC_FAILED");
  }

  private normalizeShop(shop: string): ShopifyShopDomain {
    const normalized = shop.trim().toLowerCase();

    if (normalized.length === 0 || !normalized.endsWith(".myshopify.com")) {
      throw AppError.badRequest("Invalid Shopify shop domain.", { shop }, "SHOP_DOMAIN_INVALID");
    }

    return normalized as ShopifyShopDomain;
  }

  private assertPattern(value: string, pattern: RegExp, message: string, code: string): void {
    if (!pattern.test(value.trim())) {
      throw AppError.badRequest(message, { value }, code);
    }
  }

  private assertMoney(value: number, message: string, code: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw AppError.badRequest(message, { value }, code);
    }
  }

  private assertPositiveMoney(value: number, message: string, code: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw AppError.badRequest(message, { value }, code);
    }
  }

  private assertTargetMargin(value: number): void {
    if (!Number.isFinite(value) || value <= 0 || value >= 100) {
      throw AppError.badRequest(
        "Target margin percentage must be greater than 0 and below 100.",
        { targetMarginPercentage: value },
        "TARGET_MARGIN_INVALID",
      );
    }
  }

  private assertInventoryQuantity(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw AppError.badRequest(
        "Inventory quantity must be a non-negative integer.",
        { currentInventoryQuantity: value },
        "INVENTORY_QUANTITY_INVALID",
      );
    }
  }

  private assertCurrency(value: string): void {
    if (!/^[A-Za-z]{3}$/u.test(value.trim())) {
      throw AppError.badRequest("Currency must be a three-letter code.", { currency: value }, "CURRENCY_INVALID");
    }
  }

  private formatMoney(value: number): string {
    return this.roundMoney(value).toFixed(2);
  }

  private roundMoney(value: number): number {
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  private roundPercentage(value: number): number {
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }
}
