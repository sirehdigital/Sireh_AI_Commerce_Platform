import type {
  ProductCost,
  ProductImage,
  ProductVariant,
} from "../../../ai-product/types/product.types.js";
import type {
  ShopifyDraftPreparationInput,
  ShopifyDraftPreparationProductSnapshot,
  ShopifyProductSnapshotMappingResult,
} from "./shopify-draft-preparation.types.js";

export class ShopifyProductSnapshotMapper {
  public map(
    snapshot: ShopifyDraftPreparationProductSnapshot,
    input: ShopifyDraftPreparationInput,
  ): ShopifyProductSnapshotMappingResult {
    const cost = this.mapCost(input);
    const warnings = cost.productCost === 0 && input.supplierCost === undefined
      ? [
          {
            code: "missing-supplier-cost" as const,
            message:
              "Supplier cost was not supplied; pricing recommendation must be skipped for this read-only sprint.",
          },
        ]
      : [];

    return {
      sourceProduct: {
        sourceId: snapshot.id,
        sourceUrl: snapshot.onlineStoreUrl ?? `shopify://${input.shopDomain}/products/${snapshot.handle}`,
        title: snapshot.title,
        description: this.toPlainText(snapshot.descriptionHtml),
        brand: snapshot.vendor,
        category: snapshot.productType,
        productType: snapshot.productType,
        tags: [...snapshot.tags],
        images: this.mapImages(snapshot),
        options: snapshot.options.map((option) => ({ name: option.name, values: [...option.values] })),
        variants: this.mapVariants(snapshot),
        supplier: {
          source: "shopify",
          supplierName: snapshot.vendor,
          supplierProductId: snapshot.id,
          supplierProductUrl: snapshot.onlineStoreUrl ?? `shopify://${input.shopDomain}/products/${snapshot.handle}`,
        },
        cost,
        currency: snapshot.storeCurrency,
        targetMarkets: [...input.brandContext.targetMarkets],
      },
      warnings,
      pricingSafelyAvailable: input.supplierCost !== undefined,
    };
  }

  private mapCost(input: ShopifyDraftPreparationInput): ProductCost {
    const cost = input.supplierCost;

    if (cost === undefined) {
      return {
        productCost: 0,
        shippingCost: 0,
        transactionCost: 0,
        advertisingCostEstimate: 0,
        totalLandedCost: 0,
        currency: input.brandContext.sellingCurrency,
      };
    }

    return {
      productCost: cost.productCost,
      shippingCost: cost.shippingCost,
      transactionCost: cost.transactionCost,
      advertisingCostEstimate: cost.advertisingCostEstimate,
      totalLandedCost: cost.productCost + cost.shippingCost + cost.transactionCost + cost.advertisingCostEstimate,
      currency: cost.currency,
    };
  }

  private mapImages(snapshot: ShopifyDraftPreparationProductSnapshot): readonly ProductImage[] {
    return snapshot.media.map((media, index) => ({
      id: media.id,
      url: media.url,
      ...(media.altText === undefined ? {} : { altText: media.altText }),
      position: index + 1,
      isPrimary: index === 0,
    }));
  }

  private mapVariants(snapshot: ShopifyDraftPreparationProductSnapshot): readonly ProductVariant[] {
    return snapshot.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      optionValues: { ...variant.optionValues },
      suggestedPrice: variant.price,
      ...(variant.compareAtPrice === undefined ? {} : { compareAtPrice: variant.compareAtPrice }),
      currency: snapshot.storeCurrency,
      inventoryQuantity: variant.inventoryQuantities.reduce((total, quantity) => total + quantity.quantity, 0),
      available: variant.inventoryQuantities.some((quantity) => quantity.quantity > 0),
    }));
  }

  private toPlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/giu, "\n")
      .replace(/<\/p>/giu, "\n\n")
      .replace(/<[^>]*>/gu, "")
      .replace(/&nbsp;/gu, " ")
      .replace(/&amp;/gu, "&")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();
  }
}
