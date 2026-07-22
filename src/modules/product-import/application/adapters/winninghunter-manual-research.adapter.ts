import { GenericSupplierAdapter } from "./generic-supplier.adapter.js";
import type { SupplierProductImportInput } from "../../domain/models/product-import.model.js";
import type { SupplierProductAdapter } from "./supplier-product-adapter.js";

export interface WinningHunterManualPayload {
  readonly researchId: string;
  readonly productUrl?: string;
  readonly supplierName?: string;
  readonly title: string;
  readonly notes?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly imageUrls?: readonly string[];
  readonly supplierPrice?: number;
  readonly compareAtPrice?: number;
  readonly currency?: string;
  readonly inventory?: number;
  readonly shippingOrigin?: string;
  readonly shippingDestinations?: readonly string[];
  readonly estimatedDeliveryDays?: { readonly min?: number; readonly max?: number };
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class WinningHunterManualResearchAdapter implements SupplierProductAdapter<WinningHunterManualPayload> {
  public readonly sourcePlatform = "winninghunter" as const;

  private readonly genericAdapter = new GenericSupplierAdapter();

  public adapt(payload: WinningHunterManualPayload): SupplierProductImportInput {
    return this.genericAdapter.adapt({
      externalProductId: payload.researchId,
      sourcePlatform: this.sourcePlatform,
      supplierName: payload.supplierName ?? "WinningHunter Manual Research",
      supplierUrl: payload.productUrl,
      title: payload.title,
      description: payload.notes,
      brand: payload.brand,
      category: payload.category,
      productType: payload.productType,
      images: (payload.imageUrls ?? []).map((url, index) => ({ url, position: index + 1, isPrimary: index === 0 })),
      variants: [
        {
          externalVariantId: `${payload.researchId}:default`,
          sku: `WH-${payload.researchId}`,
          title: "Default Title",
          optionValues: { Title: "Default Title" },
          supplierPrice: payload.supplierPrice,
          compareAtPrice: payload.compareAtPrice,
          currency: payload.currency,
          inventory: payload.inventory,
          available: payload.inventory === undefined || payload.inventory > 0,
        },
      ],
      supplierPrice: payload.supplierPrice,
      compareAtPrice: payload.compareAtPrice,
      currency: payload.currency ?? "USD",
      inventory: payload.inventory,
      shippingOrigin: payload.shippingOrigin,
      shippingDestinations: payload.shippingDestinations ?? [],
      estimatedDelivery: {
        minDays: payload.estimatedDeliveryDays?.min,
        maxDays: payload.estimatedDeliveryDays?.max,
      },
      tags: payload.tags ?? ["winninghunter", "manual-research"],
      rawMetadata: payload.metadata ?? { researchId: payload.researchId },
    });
  }
}
