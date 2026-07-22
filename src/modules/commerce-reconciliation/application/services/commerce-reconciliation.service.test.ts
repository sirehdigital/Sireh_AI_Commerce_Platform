import { describe, expect, it } from "vitest";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { CommerceReconciliationInput } from "../../domain/models/commerce-reconciliation.model.js";
import { CommerceReconciliationService } from "./commerce-reconciliation.service.js";

const NOW = new Date("2026-07-18T12:30:00.000Z");
const PRODUCT_ID = "gid://shopify/Product/1001";
const VARIANT_ID = "gid://shopify/ProductVariant/2001";

const buildInput = (overrides: Partial<CommerceReconciliationInput> = {}): CommerceReconciliationInput => ({
  internalProductReference: "draft-1",
  shopifyProductId: PRODUCT_ID,
  shopifyVariantId: VARIANT_ID,
  expectedSellingPrice: 30,
  syncedSellingPrice: 30,
  expectedInventoryQuantity: 10,
  syncedInventoryQuantity: 10,
  supplierQuantity: 12,
  expectedCurrency: "USD",
  syncedCurrency: "USD",
  shopifyOrders: [
    {
      orderId: "gid://shopify/Order/3001",
      orderNumber: "#1001",
      currency: "USD",
      itemCount: 2,
      lineItems: [
        {
          lineItemId: "gid://shopify/LineItem/4001",
          title: "Velvet Glow",
          shopifyVariantId: VARIANT_ID,
          quantity: 2,
        },
      ],
    },
  ],
  ...overrides,
});

const createService = (): CommerceReconciliationService => new CommerceReconciliationService(() => NOW);

describe("CommerceReconciliationService", () => {
  it("returns a fully healthy reconciliation", () => {
    const result = createService().reconcile(buildInput());

    expect(result).toMatchObject({
      overallStatus: "HEALTHY",
      healthScore: 100,
      warnings: [],
      errors: [],
      requiresAttention: false,
      reconciledAt: NOW,
    });
    expect(result.checks.every((check) => check.status === "PASS")).toBe(true);
  });

  it("flags missing or malformed Shopify product and variant identifiers", () => {
    const result = createService().reconcile(
      buildInput({
        shopifyProductId: "bad-product",
        shopifyVariantId: "bad-variant",
      }),
    );

    expect(result.overallStatus).toBe("ERROR");
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["SHOPIFY_PRODUCT_ID_PRESENT", "SHOPIFY_VARIANT_ID_PRESENT"]),
    );
  });

  it("warns on price mismatch outside tolerance", () => {
    const result = createService().reconcile(
      buildInput({
        expectedSellingPrice: 30,
        syncedSellingPrice: 31,
        priceTolerance: 0.25,
      }),
    );

    expect(result.overallStatus).toBe("WARNING");
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "PRICE_MATCH", expectedValue: 30, actualValue: 31 })]),
    );
  });

  it("errors on currency mismatch", () => {
    const result = createService().reconcile(buildInput({ expectedCurrency: "USD", syncedCurrency: "MYR" }));

    expect(result.overallStatus).toBe("ERROR");
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "CURRENCY_MATCH", expectedValue: "USD", actualValue: "MYR" })]),
    );
  });

  it("warns on inventory mismatch", () => {
    const result = createService().reconcile(
      buildInput({
        expectedInventoryQuantity: 10,
        syncedInventoryQuantity: 8,
      }),
    );

    expect(result.overallStatus).toBe("WARNING");
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "INVENTORY_MATCH", expectedValue: 10, actualValue: 8 })]),
    );
  });

  it("warns when supplier stock is lower than Shopify inventory", () => {
    const result = createService().reconcile(buildInput({ supplierQuantity: 4, syncedInventoryQuantity: 10 }));

    expect(result.overallStatus).toBe("WARNING");
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SUPPLIER_STOCK_AVAILABLE" })]));
  });

  it("errors on unknown order variants", () => {
    const result = createService().reconcile(
      buildInput({
        shopifyOrders: [
          {
            orderId: "gid://shopify/Order/3001",
            orderNumber: "#1001",
            currency: "USD",
            itemCount: 1,
            lineItems: [
              {
                lineItemId: "gid://shopify/LineItem/4001",
                title: "Different item",
                shopifyVariantId: "gid://shopify/ProductVariant/9999",
                quantity: 1,
              },
            ],
          },
        ],
      }),
    );

    expect(result.overallStatus).toBe("ERROR");
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ message: "Order line item variant is unknown." })]));
  });

  it("warns when ordered quantity exceeds available inventory", () => {
    const result = createService().reconcile(
      buildInput({
        syncedInventoryQuantity: 1,
        shopifyOrders: [
          {
            orderId: "gid://shopify/Order/3001",
            orderNumber: "#1001",
            currency: "USD",
            itemCount: 3,
            lineItems: [
              {
                lineItemId: "gid://shopify/LineItem/4001",
                title: "Velvet Glow",
                shopifyVariantId: VARIANT_ID,
                quantity: 3,
              },
            ],
          },
        ],
      }),
    );

    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ message: "Ordered quantity exceeds available inventory." })]));
  });

  it("calculates health score deterministically", () => {
    const result = createService().reconcile(
      buildInput({
        expectedSellingPrice: 30,
        syncedSellingPrice: 35,
        expectedInventoryQuantity: 10,
        syncedInventoryQuantity: 8,
        supplierQuantity: 4,
        shopifyOrders: [
          {
            orderId: "gid://shopify/Order/3001",
            orderNumber: "#1001",
            currency: "USD",
            itemCount: 9,
            lineItems: [
              {
                lineItemId: "gid://shopify/LineItem/4001",
                title: "Velvet Glow",
                shopifyVariantId: VARIANT_ID,
                quantity: 9,
              },
            ],
          },
        ],
      }),
    );

    expect(result.warnings).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
    expect(result.healthScore).toBe(68);
  });

  it("prioritizes ERROR overall status over warnings", () => {
    const result = createService().reconcile(
      buildInput({
        syncedCurrency: "MYR",
        expectedInventoryQuantity: 10,
        syncedInventoryQuantity: 8,
      }),
    );

    expect(result.overallStatus).toBe("ERROR");
    expect(result.requiresAttention).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects malformed input", () => {
    const service = createService();
    const invalidInputs = [
      buildInput({ internalProductReference: " " }),
      buildInput({ expectedSellingPrice: -1 }),
      buildInput({ syncedInventoryQuantity: 1.5 }),
      buildInput({ syncedCurrency: "US" }),
      buildInput({ shopifyOrders: [{ orderId: "order-1", orderNumber: "#1", currency: "USD", itemCount: 1, lineItems: [{ lineItemId: "line-1", title: "Item", shopifyVariantId: "", quantity: 1 }] }] }),
    ];

    for (const input of invalidInputs) {
      expect(() => service.reconcile(input)).toThrow(AppError);
    }
  });

  it("does not mutate input data", () => {
    const service = createService();
    const input = buildInput({
      internalProductReference: " draft-1 ",
      expectedCurrency: "usd",
      syncedCurrency: "usd",
    });
    const snapshot = JSON.stringify(input);

    service.reconcile(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
