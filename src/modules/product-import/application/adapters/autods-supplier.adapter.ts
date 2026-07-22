import { GenericSupplierAdapter } from "./generic-supplier.adapter.js";
import type { SupplierProductImportInput } from "../../domain/models/product-import.model.js";
import type { SupplierProductAdapter } from "./supplier-product-adapter.js";

export interface AutoDsImportPayload {
  readonly productId: string;
  readonly supplier?: string;
  readonly sourceUrl?: string;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly images?: readonly { readonly url: string; readonly alt?: string }[];
  readonly variants?: readonly {
    readonly id?: string;
    readonly sku?: string;
    readonly title?: string;
    readonly options?: Readonly<Record<string, string>>;
    readonly cost?: number;
    readonly compareAt?: number;
    readonly currency?: string;
    readonly inventory?: number;
  }[];
  readonly price?: number;
  readonly compareAtPrice?: number;
  readonly currency?: string;
  readonly inventory?: number;
  readonly shipsFrom?: string;
  readonly shipsTo?: readonly string[];
  readonly delivery?: { readonly minDays?: number; readonly maxDays?: number };
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class AutoDsSupplierAdapter implements SupplierProductAdapter<AutoDsImportPayload> {
  public readonly sourcePlatform = "autods" as const;

  private readonly genericAdapter = new GenericSupplierAdapter();

  public adapt(payload: AutoDsImportPayload): SupplierProductImportInput {
    const variants = payload.variants?.map((variant) => ({
      externalVariantId: variant.id,
      sku: variant.sku,
      title: variant.title,
      optionValues: variant.options,
      supplierPrice: variant.cost,
      compareAtPrice: variant.compareAt,
      currency: variant.currency,
      inventory: variant.inventory,
      available: variant.inventory === undefined || variant.inventory > 0,
    })) ?? [
      {
        externalVariantId: `${payload.productId}:default`,
        sku: `AUTODS-${payload.productId}`,
        title: "Default Title",
        optionValues: { Title: "Default Title" },
        supplierPrice: payload.price,
        compareAtPrice: payload.compareAtPrice,
        currency: payload.currency,
        inventory: payload.inventory,
        available: payload.inventory === undefined || payload.inventory > 0,
      },
    ];

    return this.genericAdapter.adapt({
      externalProductId: payload.productId,
      sourcePlatform: this.sourcePlatform,
      supplierName: payload.supplier ?? "AutoDS",
      supplierUrl: payload.sourceUrl,
      title: payload.title,
      description: payload.description,
      brand: payload.brand,
      category: payload.category,
      productType: payload.productType,
      images: (payload.images ?? []).map((image, index) => ({
        url: image.url,
        altText: image.alt,
        position: index + 1,
        isPrimary: index === 0,
      })),
      variants,
      supplierPrice: payload.price,
      compareAtPrice: payload.compareAtPrice,
      currency: payload.currency ?? "USD",
      inventory: payload.inventory,
      shippingOrigin: payload.shipsFrom,
      shippingDestinations: payload.shipsTo ?? [],
      estimatedDelivery: payload.delivery,
      tags: payload.tags ?? ["autods"],
      rawMetadata: payload.metadata ?? { productId: payload.productId, integrationMode: "manual-import-payload" },
    });
  }
}
