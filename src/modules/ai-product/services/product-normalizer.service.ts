import type {
  NormalizedProduct,
  ProductCost,
  ProductCurrency,
  ProductImage,
  ProductOption,
  ProductPricing,
  ProductVariant,
  RawProductInput,
  SupplierInformation,
  TargetMarket,
} from "../types/product.types.js";

const DEFAULT_TITLE = "Untitled Product";
const DEFAULT_BRAND = "Unbranded";
const DEFAULT_CATEGORY = "Uncategorized";
const DEFAULT_MARKETS: readonly TargetMarket[] = ["US", "UK", "AU", "CA"];

/**
 * Converts raw supplier or manual product input into the internal SACP product format.
 */
export class ProductNormalizerService {
  /**
   * Normalizes raw product input into a deterministic provider-neutral product record.
   */
  public normalize(input: RawProductInput): NormalizedProduct {
    const title = this.normalizeText(input.title, DEFAULT_TITLE);
    const description = this.normalizeDescription(input.description);
    const productId = this.buildProductId(input.source, input.externalId, title);
    const category = this.normalizeText(input.category, DEFAULT_CATEGORY);
    const variants = this.normalizeVariants(input.variants, productId);
    const cost = this.buildCost(input, variants);
    const pricing = this.buildPricing(cost, variants);
    const now = new Date();

    return {
      id: productId,
      source: input.source,
      ...(this.hasUsableText(input.externalId) ? { externalId: input.externalId.trim() } : {}),
      status: "draft",
      title,
      ...(this.hasUsableText(input.title) ? { originalTitle: input.title } : {}),
      description,
      ...(this.hasUsableText(input.description)
        ? { originalDescription: this.normalizeLineEndings(input.description) }
        : {}),
      brand: this.normalizeText(input.brand, DEFAULT_BRAND),
      category,
      productType: category,
      tags: this.normalizeTags(input.tags),
      targetMarkets: this.normalizeMarkets(input.targetMarkets),
      supplier: this.normalizeSupplier(input),
      images: this.normalizeImages(input.images, productId),
      options: this.normalizeOptions(input.options),
      variants,
      cost,
      pricing,
      createdAt: this.normalizeDate(input.capturedAt, now),
      updatedAt: now,
    };
  }

  private buildProductId(source: RawProductInput["source"], externalId: string | undefined, title: string): string {
    const identity = this.hasUsableText(externalId) ? externalId : title;
    return `product:${this.sanitizeKey(source)}:${this.sanitizeKey(identity)}`;
  }

  private normalizeText(value: string | undefined, fallback: string): string {
    if (!this.hasUsableText(value)) {
      return fallback;
    }

    const normalized = value
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();

    return normalized.length > 0 ? normalized : fallback;
  }

  private normalizeDescription(value: string | undefined): string {
    if (!this.hasUsableText(value)) {
      return "";
    }

    return this.normalizeLineEndings(value)
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();
  }

  private normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/gu, "\n");
  }

  private normalizeTags(tags: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const tag of tags) {
      const value = this.normalizeText(tag, "");
      const key = value.toLowerCase();

      if (value.length === 0 || seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push(value);
    }

    return normalized;
  }

  private normalizeMarkets(markets: readonly TargetMarket[]): readonly TargetMarket[] {
    const seen = new Set<TargetMarket>();
    const normalized: TargetMarket[] = [];

    for (const market of markets) {
      if (!seen.has(market)) {
        seen.add(market);
        normalized.push(market);
      }
    }

    return normalized.length > 0 ? normalized : [...DEFAULT_MARKETS];
  }

  private normalizeSupplier(input: RawProductInput): SupplierInformation {
    const supplier = input.supplier;

    return {
      source: input.source,
      supplierName: this.normalizeText(supplier?.supplierName, ""),
      supplierProductId: this.normalizeText(supplier?.supplierProductId ?? input.externalId, ""),
      supplierProductUrl: this.normalizeText(supplier?.supplierProductUrl ?? input.productUrl, ""),
      supplierStoreUrl: this.normalizeText(supplier?.supplierStoreUrl, ""),
      shippingOrigin: this.normalizeText(supplier?.shippingOrigin, ""),
      ...(this.isFiniteNonNegativeNumber(supplier?.estimatedDeliveryDaysMin)
        ? { estimatedDeliveryDaysMin: supplier.estimatedDeliveryDaysMin }
        : {}),
      ...(this.isFiniteNonNegativeNumber(supplier?.estimatedDeliveryDaysMax)
        ? { estimatedDeliveryDaysMax: supplier.estimatedDeliveryDaysMax }
        : {}),
      ...(this.isFiniteNonNegativeNumber(supplier?.supplierRating)
        ? { supplierRating: supplier.supplierRating }
        : {}),
      ...(this.isFiniteNonNegativeNumber(supplier?.orderCount) ? { orderCount: supplier.orderCount } : {}),
    };
  }

  private normalizeImages(images: readonly ProductImage[], productId: string): readonly ProductImage[] {
    const deduped = new Map<string, ProductImage>();

    for (const image of images) {
      const url = image.url.trim();

      if (url.length === 0 || deduped.has(url)) {
        continue;
      }

      deduped.set(url, image);
    }

    const sorted = [...deduped.values()].sort(
      (left, right) => (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER),
    );

    const primaryIndex = sorted.findIndex((image) => image.isPrimary === true);

    return sorted.map((image, index) => {
      const position = index + 1;
      const isPrimary = primaryIndex >= 0 ? index === primaryIndex : index === 0;

      return {
        id: this.hasUsableText(image.id) ? image.id.trim() : `image:${productId}:${position}`,
        url: image.url.trim(),
        ...(this.hasUsableText(image.altText) ? { altText: image.altText.trim() } : {}),
        position,
        ...(this.isFiniteNonNegativeNumber(image.width) ? { width: image.width } : {}),
        ...(this.isFiniteNonNegativeNumber(image.height) ? { height: image.height } : {}),
        isPrimary,
      };
    });
  }

  private normalizeOptions(options: readonly ProductOption[]): readonly ProductOption[] {
    const seenNames = new Set<string>();
    const normalized: ProductOption[] = [];

    for (const option of options) {
      const name = this.normalizeText(option.name, "");
      const nameKey = name.toLowerCase();

      if (name.length === 0 || seenNames.has(nameKey)) {
        continue;
      }

      const values = this.normalizeUniqueValues(option.values);

      if (values.length === 0) {
        continue;
      }

      seenNames.add(nameKey);
      normalized.push({ name, values });
    }

    return normalized;
  }

  private normalizeVariants(variants: readonly ProductVariant[], productId: string): readonly ProductVariant[] {
    const seen = new Set<string>();
    const normalized: ProductVariant[] = [];

    for (const variant of variants) {
      const dedupeKey = this.getVariantDedupeKey(variant);

      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      normalized.push(this.normalizeVariant(variant, productId, normalized.length + 1));
    }

    return normalized;
  }

  private normalizeVariant(variant: ProductVariant, productId: string, position: number): ProductVariant {
    return {
      id: this.hasUsableText(variant.id) ? variant.id.trim() : `variant:${productId}:${position}`,
      ...(this.hasUsableText(variant.supplierVariantId)
        ? { supplierVariantId: variant.supplierVariantId.trim() }
        : {}),
      ...(this.hasUsableText(variant.sku) ? { sku: variant.sku.trim() } : {}),
      title: this.normalizeText(variant.title, `Variant ${position}`),
      optionValues: this.normalizeOptionValues(variant.optionValues),
      ...(this.isFiniteNonNegativeNumber(variant.cost) ? { cost: variant.cost } : {}),
      ...(this.isFiniteNonNegativeNumber(variant.suggestedPrice)
        ? { suggestedPrice: variant.suggestedPrice }
        : {}),
      ...(this.isFiniteNonNegativeNumber(variant.compareAtPrice)
        ? { compareAtPrice: variant.compareAtPrice }
        : {}),
      currency: variant.currency,
      ...(this.isFiniteNumber(variant.inventoryQuantity)
        ? { inventoryQuantity: Math.max(0, variant.inventoryQuantity) }
        : {}),
      ...(this.isFiniteNonNegativeNumber(variant.weight) ? { weight: variant.weight } : {}),
      ...(variant.weightUnit === undefined ? {} : { weightUnit: variant.weightUnit }),
      ...(this.hasUsableText(variant.imageUrl) ? { imageUrl: variant.imageUrl.trim() } : {}),
      available: variant.available,
    };
  }

  private getVariantDedupeKey(variant: ProductVariant): string {
    if (this.hasUsableText(variant.supplierVariantId)) {
      return `supplier:${variant.supplierVariantId.trim().toLowerCase()}`;
    }

    if (this.hasUsableText(variant.id)) {
      return `id:${variant.id.trim().toLowerCase()}`;
    }

    if (this.hasUsableText(variant.sku)) {
      return `sku:${variant.sku.trim().toLowerCase()}`;
    }

    return `title:${this.normalizeText(variant.title, "").toLowerCase()}`;
  }

  private buildCost(input: RawProductInput, variants: readonly ProductVariant[]): ProductCost {
    const productCost = this.lowestNonNegative(variants.map((variant) => variant.cost));
    const shippingCost = this.getMetadataNumber(input.metadata, "shippingCost");
    const transactionCost = this.getMetadataNumber(input.metadata, "transactionCost");
    const advertisingCostEstimate = this.getMetadataNumber(input.metadata, "advertisingCostEstimate");
    const currency = this.firstCurrency(variants);

    return {
      productCost,
      shippingCost,
      transactionCost,
      advertisingCostEstimate,
      totalLandedCost: productCost + shippingCost + transactionCost + advertisingCostEstimate,
      currency,
    };
  }

  private buildPricing(cost: ProductCost, variants: readonly ProductVariant[]): ProductPricing {
    const sellingPrice = this.lowestNonNegative(variants.map((variant) => variant.suggestedPrice));
    const compareAtPrice = this.lowestNonNegativeOptional(variants.map((variant) => variant.compareAtPrice));
    const grossProfit = sellingPrice - cost.totalLandedCost;
    const grossMarginPercentage = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
    const markupPercentage = cost.totalLandedCost > 0 ? (grossProfit / cost.totalLandedCost) * 100 : 0;

    return {
      cost: cost.totalLandedCost,
      sellingPrice,
      ...(compareAtPrice === undefined ? {} : { compareAtPrice }),
      grossProfit: this.finiteOrZero(grossProfit),
      grossMarginPercentage: this.finiteOrZero(grossMarginPercentage),
      markupPercentage: this.finiteOrZero(markupPercentage),
      currency: cost.currency,
    };
  }

  private normalizeDate(value: Date, fallback: Date): Date {
    return Number.isFinite(value.getTime()) ? value : fallback;
  }

  private normalizeUniqueValues(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const value of values) {
      const normalizedValue = this.normalizeText(value, "");
      const key = normalizedValue.toLowerCase();

      if (normalizedValue.length === 0 || seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push(normalizedValue);
    }

    return normalized;
  }

  private normalizeOptionValues(values: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(values)) {
      const normalizedKey = this.normalizeText(key, "");
      const normalizedValue = this.normalizeText(value, "");

      if (normalizedKey.length > 0 && normalizedValue.length > 0) {
        normalized[normalizedKey] = normalizedValue;
      }
    }

    return normalized;
  }

  private getMetadataNumber(metadata: Readonly<Record<string, unknown>>, key: string): number {
    const value = metadata[key];
    return this.isFiniteNonNegativeNumber(value) ? value : 0;
  }

  private lowestNonNegative(values: readonly (number | undefined)[]): number {
    return this.lowestNonNegativeOptional(values) ?? 0;
  }

  private lowestNonNegativeOptional(values: readonly (number | undefined)[]): number | undefined {
    const validValues = values.filter((value): value is number => this.isFiniteNonNegativeNumber(value));

    if (validValues.length === 0) {
      return undefined;
    }

    return Math.min(...validValues);
  }

  private firstCurrency(variants: readonly ProductVariant[]): ProductCurrency {
    return variants[0]?.currency ?? "USD";
  }

  private sanitizeKey(value: string): string {
    const sanitized = value.trim().toLowerCase().replace(/\s+/gu, "-").replace(/[^a-z0-9:_-]/gu, "-");
    return sanitized.length > 0 ? sanitized : "unknown";
  }

  private hasUsableText(value: string | undefined): value is string {
    return value !== undefined && value.trim().length > 0;
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }

  private isFiniteNonNegativeNumber(value: unknown): value is number {
    return this.isFiniteNumber(value) && value >= 0;
  }

  private finiteOrZero(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }
}
