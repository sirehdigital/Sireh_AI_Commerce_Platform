import { describe, expect, it } from "vitest";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { SupplierProductImportInput } from "../../domain/models/product-import.model.js";
import { ProductImportInputValidator } from "./product-import-input-validator.service.js";

const validInput = (): SupplierProductImportInput => ({
  externalProductId: "generic-001",
  sourcePlatform: "generic",
  supplierName: "Lumora Supplier",
  supplierUrl: "https://supplier.test/products/generic-001",
  title: "Lumora Botanical Body Lotion",
  description:
    "A premium botanical body lotion prepared for a calm beauty routine with polished merchandising data.",
  brand: "Lumora",
  category: "Body Lotion",
  productType: "Body Care",
  images: [{ url: "https://images.test/body-lotion.jpg", altText: "Lumora lotion", isPrimary: true }],
  variants: [
    {
      externalVariantId: "generic-001-default",
      sku: "LUMORA-LOTION",
      title: "Default Title",
      optionValues: { Title: "Default Title" },
      supplierPrice: 8,
      compareAtPrice: 28,
      currency: "USD",
      inventory: 25,
    },
  ],
  supplierPrice: 8,
  compareAtPrice: 28,
  currency: "USD",
  inventory: 25,
  shippingOrigin: "US",
  shippingDestinations: ["US", "CA", "GLOBAL"],
  estimatedDelivery: { minDays: 3, maxDays: 7 },
  tags: ["beauty", "body-care"],
  rawMetadata: { importedBy: "unit-test" },
});

describe("ProductImportInputValidator", () => {
  it("validates supplier-neutral import input and maps it to raw product input", () => {
    const result = new ProductImportInputValidator().validate(validInput());

    expect(result).toMatchObject({
      source: "other",
      externalId: "generic-001",
      title: "Lumora Botanical Body Lotion",
      brand: "Lumora",
      category: "Body Lotion",
      targetMarkets: ["US", "CA", "GLOBAL"],
    });
    expect(result.variants[0]).toMatchObject({
      supplierVariantId: "generic-001-default",
      sku: "LUMORA-LOTION",
      cost: 8,
      compareAtPrice: 28,
      inventoryQuantity: 25,
    });
  });

  it("rejects malformed input with AppError conventions", () => {
    const validator = new ProductImportInputValidator();

    expect(() =>
      validator.validate({
        ...validInput(),
        externalProductId: "",
        images: [{ url: "http://images.test/insecure.jpg" }],
        variants: [],
      }),
    ).toThrow(AppError);
  });

  it("rejects unsupported currencies before product normalization", () => {
    const validator = new ProductImportInputValidator();
    let caughtError: unknown;

    try {
      validator.validate({ ...validInput(), currency: "JPY" });
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(AppError);
    expect((caughtError as AppError).code).toBe("PRODUCT_IMPORT_VALIDATION_FAILED");
    expect((caughtError as AppError).details).toMatchObject({
      issues: [expect.objectContaining({ code: "UNSUPPORTED_CURRENCY", field: "currency" })],
    });
  });
});
