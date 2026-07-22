import { describe, expect, it } from "vitest";

import { AutoDsSupplierAdapter } from "./autods-supplier.adapter.js";
import { WinningHunterManualResearchAdapter } from "./winninghunter-manual-research.adapter.js";

describe("product import supplier adapters", () => {
  it("normalizes explicit AutoDS import payload fields without assuming live API behavior", () => {
    const adapter = new AutoDsSupplierAdapter();

    const result = adapter.adapt({
      productId: "autods-001",
      supplier: "AutoDS Supplier",
      sourceUrl: "https://supplier.test/products/autods-001",
      title: "Lumora Body Silk Lotion",
      description: "Hydrating body lotion for a polished skincare routine.",
      brand: "Lumora",
      category: "Body Lotion",
      images: [{ url: "https://images.test/body-lotion.jpg", alt: "Body lotion" }],
      variants: [
        {
          id: "variant-rose",
          sku: "AUTO-ROSE",
          title: "Rose",
          options: { Scent: "Rose" },
          cost: 8,
          compareAt: 24,
          currency: "USD",
          inventory: 12,
        },
      ],
      shipsFrom: "US",
      shipsTo: ["US", "CA"],
      delivery: { minDays: 3, maxDays: 7 },
      tags: ["autods", "beauty"],
    });

    expect(result).toMatchObject({
      externalProductId: "autods-001",
      sourcePlatform: "autods",
      supplierName: "AutoDS Supplier",
      supplierUrl: "https://supplier.test/products/autods-001",
      title: "Lumora Body Silk Lotion",
      currency: "USD",
      shippingOrigin: "US",
      shippingDestinations: ["US", "CA"],
    });
    expect(result.variants[0]).toMatchObject({
      externalVariantId: "variant-rose",
      sku: "AUTO-ROSE",
      supplierPrice: 8,
      compareAtPrice: 24,
      optionValues: { Scent: "Rose" },
    });
  });

  it("normalizes WinningHunter manual research input into a supplier-neutral import contract", () => {
    const adapter = new WinningHunterManualResearchAdapter();

    const result = adapter.adapt({
      researchId: "wh-001",
      productUrl: "https://supplier.test/products/wh-001",
      title: "Lumora Polish Body Scrub",
      notes: "Manual research notes for a premium body scrub.",
      supplierPrice: 6,
      compareAtPrice: 22,
      currency: "MYR",
      inventory: 9,
      imageUrls: ["https://images.test/body-scrub.jpg"],
      shippingOrigin: "MY",
      shippingDestinations: ["MY"],
      estimatedDeliveryDays: { min: 2, max: 5 },
    });

    expect(result.sourcePlatform).toBe("winninghunter");
    expect(result.externalProductId).toBe("wh-001");
    expect(result.supplierName).toBe("WinningHunter Manual Research");
    expect(result.images).toHaveLength(1);
    expect(result.variants[0]).toMatchObject({
      sku: "WH-wh-001",
      supplierPrice: 6,
      compareAtPrice: 22,
      inventory: 9,
    });
  });
});
