import type { AutoDsProduct } from "../../../autods/domain/models/autods-product.model.js";
import type { ProductCandidate } from "../../domain/models/product-candidate.model.js";

export class AutoDsProductCandidateMapper {
  public map(product: AutoDsProduct): ProductCandidate {
    const variant = this.requireFirstItem(product.variants, "AutoDS product requires at least one variant.");
    const shippingEstimate = this.requireFirstItem(
      product.shippingEstimates,
      "AutoDS product requires at least one shipping estimate.",
    );
    const primaryImage = product.images[0];
    const supplierRating = this.readMetadataNumber(product, "supplierRating", 0);
    const salesOrOrders = this.readMetadataNumber(product, "salesOrOrders", 0);
    const reviewCount = this.readMetadataNumber(product, "reviewCount", 0);
    const trendScore = this.readMetadataNumber(product, "trendScore", 50);
    const competitionScore = this.readMetadataNumber(product, "competitionScore", 50);

    return {
      source: "autods",
      sourceProductId: product.autoDsProductId,
      title: product.title,
      productUrl: product.supplier.supplierProductUrl,
      imageUrl: primaryImage?.url ?? variant.imageUrl ?? product.supplier.supplierProductUrl,
      supplierPrice: variant.supplierPrice.amount,
      shippingCost: shippingEstimate.cost.amount,
      suggestedSellingPrice: variant.recommendedRetailPrice?.amount ?? variant.supplierPrice.amount,
      currency: variant.recommendedRetailPrice?.currency ?? variant.supplierPrice.currency,
      estimatedDeliveryDays: shippingEstimate.maximumDeliveryDays,
      supplierRating,
      salesOrOrders,
      reviewCount,
      trendScore,
      competitionScore,
    };
  }

  private requireFirstItem<Item>(items: readonly Item[], message: string): Item {
    const item = items[0];

    if (item === undefined) {
      throw new Error(message);
    }

    return item;
  }

  private readMetadataNumber(
    product: AutoDsProduct,
    key: "supplierRating" | "salesOrOrders" | "reviewCount" | "trendScore" | "competitionScore",
    fallbackValue: number,
  ): number {
    const metadata = product as AutoDsProduct & { readonly metadata?: Readonly<Record<string, unknown>> };
    const value = metadata.metadata?.[key];

    return typeof value === "number" && Number.isFinite(value) ? value : fallbackValue;
  }
}
