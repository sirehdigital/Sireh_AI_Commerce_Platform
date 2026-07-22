import { AppError } from "../../../../shared/errors/app-error.js";
import type {
  CommerceReconciliationCheck,
  CommerceReconciliationInput,
  CommerceReconciliationOrderRecord,
  CommerceReconciliationResult,
  ReconciliationCheckCategory,
} from "../../domain/models/commerce-reconciliation.model.js";

const WARNING_DEDUCTION = 8;
const ERROR_DEDUCTION = 20;
const DEFAULT_PRICE_TOLERANCE = 0;
const SHOPIFY_PRODUCT_ID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/u;
const SHOPIFY_VARIANT_ID_PATTERN = /^gid:\/\/shopify\/ProductVariant\/\d+$/u;

export class CommerceReconciliationService {
  public constructor(private readonly now: () => Date = () => new Date()) {}

  public reconcile(input: CommerceReconciliationInput): CommerceReconciliationResult {
    const normalizedInput = this.validateInput(input);
    const checks = [
      ...this.checkProductIdentity(normalizedInput),
      ...this.checkPricing(normalizedInput),
      ...this.checkInventory(normalizedInput),
      ...this.checkOrders(normalizedInput),
    ];
    const warnings = checks.filter((check) => check.status === "WARNING");
    const errors = checks.filter((check) => check.status === "ERROR");
    const healthScore = this.clampScore(100 - warnings.length * WARNING_DEDUCTION - errors.length * ERROR_DEDUCTION);

    return {
      overallStatus: errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "HEALTHY",
      healthScore,
      checks,
      warnings,
      errors,
      requiresAttention: warnings.length > 0 || errors.length > 0,
      reconciledAt: this.now(),
    };
  }

  private validateInput(input: CommerceReconciliationInput): CommerceReconciliationInput {
    this.assertNonEmpty(input.internalProductReference, "Internal product reference is required.", "INTERNAL_PRODUCT_REFERENCE_REQUIRED");
    this.assertNonEmpty(input.shopifyProductId, "Shopify product ID is required.", "SHOPIFY_PRODUCT_ID_REQUIRED");
    this.assertNonEmpty(input.shopifyVariantId, "Shopify variant ID is required.", "SHOPIFY_VARIANT_ID_REQUIRED");
    this.assertMoney(input.expectedSellingPrice, "Expected selling price must be finite and non-negative.", "EXPECTED_PRICE_INVALID");
    this.assertMoney(input.syncedSellingPrice, "Synced selling price must be finite and non-negative.", "SYNCED_PRICE_INVALID");
    this.assertInventory(input.expectedInventoryQuantity, "Expected inventory quantity must be a non-negative integer.", "EXPECTED_INVENTORY_INVALID");
    this.assertInventory(input.syncedInventoryQuantity, "Synced inventory quantity must be a non-negative integer.", "SYNCED_INVENTORY_INVALID");
    this.assertCurrency(input.syncedCurrency, "Synced currency must be a three-letter code.", "SYNCED_CURRENCY_INVALID");

    if (input.expectedCurrency !== undefined) {
      this.assertCurrency(input.expectedCurrency, "Expected currency must be a three-letter code.", "EXPECTED_CURRENCY_INVALID");
    }

    if (input.supplierQuantity !== undefined) {
      this.assertInventory(input.supplierQuantity, "Supplier quantity must be a non-negative integer.", "SUPPLIER_QUANTITY_INVALID");
    }

    if (input.priceTolerance !== undefined && (!Number.isFinite(input.priceTolerance) || input.priceTolerance < 0)) {
      throw AppError.badRequest(
        "Price tolerance must be finite and non-negative.",
        { priceTolerance: input.priceTolerance },
        "PRICE_TOLERANCE_INVALID",
      );
    }

    for (const order of input.shopifyOrders ?? []) {
      this.validateOrder(order);
    }

    return {
      internalProductReference: input.internalProductReference.trim(),
      shopifyProductId: input.shopifyProductId.trim(),
      shopifyVariantId: input.shopifyVariantId.trim(),
      expectedSellingPrice: this.roundMoney(input.expectedSellingPrice),
      syncedSellingPrice: this.roundMoney(input.syncedSellingPrice),
      expectedInventoryQuantity: input.expectedInventoryQuantity,
      syncedInventoryQuantity: input.syncedInventoryQuantity,
      ...(input.supplierQuantity === undefined ? {} : { supplierQuantity: input.supplierQuantity }),
      ...(input.shopifyOrders === undefined ? {} : { shopifyOrders: this.copyOrders(input.shopifyOrders) }),
      ...(input.expectedCurrency === undefined ? {} : { expectedCurrency: input.expectedCurrency.trim().toUpperCase() }),
      syncedCurrency: input.syncedCurrency.trim().toUpperCase(),
      ...(input.priceTolerance === undefined ? {} : { priceTolerance: this.roundMoney(input.priceTolerance) }),
    };
  }

  private checkProductIdentity(input: CommerceReconciliationInput): readonly CommerceReconciliationCheck[] {
    return [
      this.check(
        "INTERNAL_PRODUCT_REFERENCE_PRESENT",
        "PRODUCT_IDENTITY",
        "PASS",
        "Internal product reference is present.",
        input.internalProductReference,
        input.internalProductReference,
      ),
      this.check(
        "SHOPIFY_PRODUCT_ID_PRESENT",
        "PRODUCT_IDENTITY",
        SHOPIFY_PRODUCT_ID_PATTERN.test(input.shopifyProductId) ? "PASS" : "ERROR",
        SHOPIFY_PRODUCT_ID_PATTERN.test(input.shopifyProductId)
          ? "Shopify product ID is present."
          : "Shopify product ID is malformed.",
        "gid://shopify/Product/<id>",
        input.shopifyProductId,
      ),
      this.check(
        "SHOPIFY_VARIANT_ID_PRESENT",
        "PRODUCT_IDENTITY",
        SHOPIFY_VARIANT_ID_PATTERN.test(input.shopifyVariantId) ? "PASS" : "ERROR",
        SHOPIFY_VARIANT_ID_PATTERN.test(input.shopifyVariantId)
          ? "Shopify variant ID is present."
          : "Shopify variant ID is malformed.",
        "gid://shopify/ProductVariant/<id>",
        input.shopifyVariantId,
      ),
    ];
  }

  private checkPricing(input: CommerceReconciliationInput): readonly CommerceReconciliationCheck[] {
    const tolerance = input.priceTolerance ?? DEFAULT_PRICE_TOLERANCE;
    const priceDifference = this.roundMoney(Math.abs(input.expectedSellingPrice - input.syncedSellingPrice));
    const expectedCurrency = input.expectedCurrency ?? input.syncedCurrency;

    return [
      this.check(
        "PRICE_VALUES_VALID",
        "PRICING",
        "PASS",
        "Price values are valid.",
      ),
      this.check(
        "PRICE_MATCH",
        "PRICING",
        priceDifference <= tolerance ? "PASS" : "WARNING",
        priceDifference <= tolerance
          ? "Expected price matches synced Shopify price."
          : "Expected price does not match synced Shopify price.",
        input.expectedSellingPrice,
        input.syncedSellingPrice,
      ),
      this.check(
        "CURRENCY_MATCH",
        "PRICING",
        expectedCurrency === input.syncedCurrency ? "PASS" : "ERROR",
        expectedCurrency === input.syncedCurrency ? "Currencies match." : "Expected currency does not match synced currency.",
        expectedCurrency,
        input.syncedCurrency,
      ),
    ];
  }

  private checkInventory(input: CommerceReconciliationInput): readonly CommerceReconciliationCheck[] {
    const checks: CommerceReconciliationCheck[] = [
      this.check(
        "INVENTORY_VALUES_VALID",
        "INVENTORY",
        "PASS",
        "Inventory values are valid.",
      ),
      this.check(
        "INVENTORY_MATCH",
        "INVENTORY",
        input.expectedInventoryQuantity === input.syncedInventoryQuantity ? "PASS" : "WARNING",
        input.expectedInventoryQuantity === input.syncedInventoryQuantity
          ? "Expected inventory matches synced inventory."
          : "Expected inventory does not match synced inventory.",
        input.expectedInventoryQuantity,
        input.syncedInventoryQuantity,
      ),
    ];

    if (input.supplierQuantity !== undefined) {
      checks.push(
        this.check(
          "SUPPLIER_STOCK_AVAILABLE",
          "INVENTORY",
          input.supplierQuantity < input.syncedInventoryQuantity ? "WARNING" : "PASS",
          input.supplierQuantity < input.syncedInventoryQuantity
            ? "Supplier inventory is lower than Shopify inventory."
            : "Supplier inventory can cover Shopify inventory.",
          input.syncedInventoryQuantity,
          input.supplierQuantity,
        ),
      );
    }

    return checks;
  }

  private checkOrders(input: CommerceReconciliationInput): readonly CommerceReconciliationCheck[] {
    const orders = input.shopifyOrders ?? [];

    if (orders.length === 0) {
      return [
        this.check("ORDER_DATA_OPTIONAL", "ORDERS", "PASS", "No Shopify order data was supplied for reconciliation."),
      ];
    }

    const checks: CommerceReconciliationCheck[] = [];

    for (const order of orders) {
      checks.push(
        this.check(
          `ORDER_${order.orderId}_CURRENCY_MATCH`,
          "ORDERS",
          (input.expectedCurrency ?? input.syncedCurrency) === order.currency ? "PASS" : "ERROR",
          (input.expectedCurrency ?? input.syncedCurrency) === order.currency
            ? "Order currency matches expected currency."
            : "Order currency does not match expected currency.",
          input.expectedCurrency ?? input.syncedCurrency,
          order.currency,
        ),
      );

      for (const lineItem of order.lineItems) {
        const lineItemLabel = `${order.orderId}:${lineItem.lineItemId}`;
        const variantMatches = lineItem.shopifyVariantId === input.shopifyVariantId;

        checks.push(
          this.check(
            `ORDER_LINE_${lineItemLabel}_VARIANT_MATCH`,
            "ORDERS",
            variantMatches ? "PASS" : "ERROR",
            variantMatches ? "Order line item variant matches reconciled variant." : "Order line item variant is unknown.",
            input.shopifyVariantId,
            lineItem.shopifyVariantId ?? "missing",
          ),
        );
        checks.push(
          this.check(
            `ORDER_LINE_${lineItemLabel}_QUANTITY_VALID`,
            "ORDERS",
            "PASS",
            "Order line item quantity is valid.",
            undefined,
            lineItem.quantity,
          ),
        );

        if (variantMatches) {
          checks.push(
            this.check(
              `ORDER_LINE_${lineItemLabel}_INVENTORY_COVERAGE`,
              "ORDERS",
              lineItem.quantity > input.syncedInventoryQuantity ? "WARNING" : "PASS",
              lineItem.quantity > input.syncedInventoryQuantity
                ? "Ordered quantity exceeds available inventory."
                : "Available inventory can cover ordered quantity.",
              input.syncedInventoryQuantity,
              lineItem.quantity,
            ),
          );
        }
      }
    }

    return checks;
  }

  private validateOrder(order: CommerceReconciliationOrderRecord): void {
    this.assertNonEmpty(order.orderId, "Shopify order ID is required.", "ORDER_ID_REQUIRED");
    this.assertNonEmpty(order.orderNumber, "Shopify order number is required.", "ORDER_NUMBER_REQUIRED");
    this.assertCurrency(order.currency, "Order currency must be a three-letter code.", "ORDER_CURRENCY_INVALID");

    if (!Number.isInteger(order.itemCount) || order.itemCount < 0) {
      throw AppError.badRequest("Order item count must be a non-negative integer.", { itemCount: order.itemCount }, "ORDER_ITEM_COUNT_INVALID");
    }

    for (const lineItem of order.lineItems) {
      this.assertNonEmpty(lineItem.lineItemId, "Order line item ID is required.", "ORDER_LINE_ITEM_ID_REQUIRED");
      this.assertNonEmpty(lineItem.title, "Order line item title is required.", "ORDER_LINE_ITEM_TITLE_REQUIRED");

      if (lineItem.shopifyVariantId?.trim().length === 0) {
        throw AppError.badRequest("Order line item variant ID must be non-empty when supplied.", undefined, "ORDER_LINE_ITEM_VARIANT_ID_INVALID");
      }

      this.assertInventory(lineItem.quantity, "Order line item quantity must be a non-negative integer.", "ORDER_LINE_ITEM_QUANTITY_INVALID");

      if (lineItem.currency !== undefined) {
        this.assertCurrency(lineItem.currency, "Order line item currency must be a three-letter code.", "ORDER_LINE_ITEM_CURRENCY_INVALID");
      }
    }
  }

  private copyOrders(orders: readonly CommerceReconciliationOrderRecord[]): readonly CommerceReconciliationOrderRecord[] {
    return orders.map((order) => ({
      orderId: order.orderId.trim(),
      orderNumber: order.orderNumber.trim(),
      currency: order.currency.trim().toUpperCase(),
      itemCount: order.itemCount,
      lineItems: order.lineItems.map((lineItem) => ({
        lineItemId: lineItem.lineItemId.trim(),
        title: lineItem.title.trim(),
        ...(lineItem.shopifyVariantId === undefined ? {} : { shopifyVariantId: lineItem.shopifyVariantId.trim() }),
        quantity: lineItem.quantity,
        ...(lineItem.currency === undefined ? {} : { currency: lineItem.currency.trim().toUpperCase() }),
      })),
    }));
  }

  private check(
    code: string,
    category: ReconciliationCheckCategory,
    status: CommerceReconciliationCheck["status"],
    message: string,
    expectedValue?: string | number,
    actualValue?: string | number,
  ): CommerceReconciliationCheck {
    return {
      code,
      category,
      status,
      message,
      ...(expectedValue === undefined ? {} : { expectedValue }),
      ...(actualValue === undefined ? {} : { actualValue }),
    };
  }

  private assertNonEmpty(value: string, message: string, code: string): void {
    if (value.trim().length === 0) {
      throw AppError.badRequest(message, undefined, code);
    }
  }

  private assertMoney(value: number, message: string, code: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw AppError.badRequest(message, { value }, code);
    }
  }

  private assertInventory(value: number, message: string, code: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw AppError.badRequest(message, { value }, code);
    }
  }

  private assertCurrency(value: string, message: string, code: string): void {
    if (!/^[A-Za-z]{3}$/u.test(value.trim())) {
      throw AppError.badRequest(message, { value }, code);
    }
  }

  private roundMoney(value: number): number {
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  private clampScore(value: number): number {
    return Math.min(100, Math.max(0, value));
  }
}
