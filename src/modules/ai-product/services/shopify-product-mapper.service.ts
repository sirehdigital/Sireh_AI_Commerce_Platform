import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductImage,
  ProductOption,
  ProductVariant,
  ShopifyProductPayload,
  ShopifyProductPayloadImage,
  ShopifyProductPayloadOption,
  ShopifyProductPayloadSeo,
  ShopifyProductPayloadVariant,
  ShopifyProductStatus,
} from "../types/product.types.js";
import type { ProductBrandingResult } from "./product-branding.service.js";
import type {
  ProductPricingRecommendation,
  VariantPricingRecommendation,
} from "./product-pricing.service.js";

const INTERNAL_VENDOR_FALLBACK = "Sireh Commerce";
const TITLE_LIMIT = 120;
const TAG_LIMIT = 50;
const SEO_TITLE_LIMIT = 60;
const SEO_DESCRIPTION_LIMIT = 160;
const PLACEHOLDER_VALUES = new Set([
  "unbranded",
  "uncategorized",
  "untitled product",
  "product",
  "item",
  "n/a",
  "na",
  "none",
  "unknown",
]);

/**
 * Maps completed AI Product Engine outputs into an internal Shopify-ready payload.
 */
export class ShopifyProductMapperService {
  /**
   * Builds a deterministic ShopifyProductPayload without Shopify SDK, API, database, or network access.
   */
  public map(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
    copy: ProductCopy,
    pricing: ProductPricingRecommendation,
  ): ShopifyProductPayload {
    const title = this.resolveTitle(product, branding, copy);

    return {
      title,
      descriptionHtml: this.buildDescriptionHtml(copy),
      vendor: this.resolveVendor(product),
      productType: this.resolveProductType(product),
      tags: this.buildTags(product, analysis, branding, pricing),
      status: this.resolveStatus(product),
      images: this.mapImages(product.images, title),
      options: this.mapOptions(product.options),
      variants: this.mapVariants(product, pricing),
      seo: this.buildSeo(copy, title),
    };
  }

  private resolveTitle(
    product: NormalizedProduct,
    branding: ProductBrandingResult,
    copy: ProductCopy,
  ): string {
    return (
      this.firstMeaningfulValue([
        copy.brandedTitle,
        branding.brandedTitle,
        product.title,
        "Untitled Product",
      ]) ?? "Untitled Product"
    );
  }

  private buildDescriptionHtml(copy: ProductCopy): string {
    const sections = [
      this.buildParagraph(copy.shortDescription),
      this.buildParagraphs(copy.fullDescription),
      this.buildUnorderedList("Benefits", copy.benefits),
      this.buildUnorderedList("Product Highlights", copy.featureHighlights),
      this.buildOrderedList("How to Use", copy.howToUse ?? []),
      this.buildFaq(copy.faq),
      this.buildCallToAction(copy.callToAction),
    ];

    return sections.filter((section) => section.length > 0).join("\n\n");
  }

  private buildParagraph(value: string): string {
    const normalized = this.normalizeText(value);
    return normalized.length > 0 ? `<p>${this.escapeHtml(normalized)}</p>` : "";
  }

  private buildParagraphs(value: string): string {
    const paragraphs = this.normalizeParagraphs(value);

    if (paragraphs.length === 0) {
      return "";
    }

    const content = paragraphs
      .map((paragraph) => `<p>${this.escapeHtml(paragraph)}</p>`)
      .join("\n");

    return `<div>\n${content}\n</div>`;
  }

  private buildUnorderedList(title: string, items: readonly string[]): string {
    const normalizedItems = this.normalizeList(items);

    if (normalizedItems.length === 0) {
      return "";
    }

    return [
      `<h2>${this.escapeHtml(title)}</h2>`,
      "<ul>",
      ...normalizedItems.map((item) => `  <li>${this.escapeHtml(item)}</li>`),
      "</ul>",
    ].join("\n");
  }

  private buildOrderedList(title: string, items: readonly string[]): string {
    const normalizedItems = this.normalizeList(items);

    if (normalizedItems.length === 0) {
      return "";
    }

    return [
      `<h2>${this.escapeHtml(title)}</h2>`,
      "<ol>",
      ...normalizedItems.map((item) => `  <li>${this.escapeHtml(item)}</li>`),
      "</ol>",
    ].join("\n");
  }

  private buildFaq(items: ProductCopy["faq"]): string {
    const normalizedItems = items
      .map((item) => ({
        question: this.normalizeText(item.question),
        answer: this.normalizeText(item.answer),
      }))
      .filter((item) => item.question.length > 0 && item.answer.length > 0);

    if (normalizedItems.length === 0) {
      return "";
    }

    return [
      "<h2>Frequently Asked Questions</h2>",
      ...normalizedItems.flatMap((item) => [
        `<h3>${this.escapeHtml(item.question)}</h3>`,
        `<p>${this.escapeHtml(item.answer)}</p>`,
      ]),
    ].join("\n");
  }

  private buildCallToAction(value: string): string {
    const normalized = this.normalizeText(value);
    return normalized.length > 0 ? `<p><strong>${this.escapeHtml(normalized)}</strong></p>` : "";
  }

  private resolveVendor(product: NormalizedProduct): string {
    const brand = this.normalizeText(product.brand);

    if (this.isMeaningfulValue(brand)) {
      return brand;
    }

    const supplierName = this.normalizeText(product.supplier?.supplierName);

    if (this.isMeaningfulValue(supplierName)) {
      return supplierName;
    }

    return INTERNAL_VENDOR_FALLBACK;
  }

  private resolveProductType(product: NormalizedProduct): string {
    return this.firstMeaningfulValue([product.productType, product.category, "General"]) ?? "General";
  }

  private buildTags(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
    pricing: ProductPricingRecommendation,
  ): readonly string[] {
    const readableTags = [
      ...product.tags,
      product.category,
      product.productType,
      this.isMeaningfulValue(product.brand) ? product.brand : "",
    ];
    const systemTags = [
      ...product.targetMarkets.map((market) => `market-${market}`),
      `positioning-${branding.positioningTier}`,
      `voice-${branding.brandVoice}`,
      `recommendation-${analysis.recommendation}`,
      `pricing-${pricing.strategy}`,
    ];

    return this.uniqueValues([
      ...readableTags.map((tag) => this.normalizeText(tag)),
      ...systemTags.map((tag) => this.toKebabCase(tag)),
    ])
      .filter((tag) => tag.length > 0)
      .slice(0, TAG_LIMIT);
  }

  private resolveStatus(product: NormalizedProduct): ShopifyProductStatus {
    if (product.status === "published") {
      return "active";
    }

    if (product.status === "archived") {
      return "archived";
    }

    return "draft";
  }

  private mapImages(
    images: readonly ProductImage[],
    title: string,
  ): readonly ShopifyProductPayloadImage[] {
    const seenUrls = new Set<string>();
    const mappedImages: ShopifyProductPayloadImage[] = [];

    for (const image of images) {
      const src = this.normalizeText(image.url);

      if (src.length === 0 || seenUrls.has(src.toLowerCase())) {
        continue;
      }

      seenUrls.add(src.toLowerCase());
      const fallbackAlt = `${title} image ${mappedImages.length + 1}`;
      const altText = this.normalizeText(image.altText) || fallbackAlt;

      mappedImages.push({
        src,
        altText: this.truncateAtWord(altText, TITLE_LIMIT),
        ...(image.position === undefined ? {} : { position: image.position }),
      });
    }

    return mappedImages;
  }

  private mapOptions(options: readonly ProductOption[]): readonly ShopifyProductPayloadOption[] {
    const seenNames = new Set<string>();
    const mappedOptions: ShopifyProductPayloadOption[] = [];

    for (const option of options) {
      const name = this.normalizeText(option.name);
      const key = name.toLowerCase();

      if (name.length === 0 || seenNames.has(key)) {
        continue;
      }

      const values = this.normalizeList(option.values);

      if (values.length === 0) {
        continue;
      }

      seenNames.add(key);
      mappedOptions.push({ name, values });
    }

    return mappedOptions;
  }

  private mapVariants(
    product: NormalizedProduct,
    pricing: ProductPricingRecommendation,
  ): readonly ShopifyProductPayloadVariant[] {
    return product.variants.map((variant, index) => {
      const variantPricing = this.findVariantPricing(variant, index, pricing.variantRecommendations);
      const price = this.resolveVariantPrice(product, variant, pricing, variantPricing);
      const compareAtPrice = this.resolveCompareAtPrice(product, variant, pricing, variantPricing, price);
      const inventoryQuantity = this.safeInventory(variant.inventoryQuantity);
      const weight = this.safeMoney(variant.weight);

      return {
        ...(this.isMeaningfulValue(variant.sku) ? { sku: this.normalizeText(variant.sku) } : {}),
        ...(this.isMeaningfulValue(variant.title)
          ? { title: this.normalizeText(variant.title) }
          : {}),
        optionValues: this.normalizeOptionValues(variant.optionValues),
        price,
        ...(compareAtPrice === undefined ? {} : { compareAtPrice }),
        ...(inventoryQuantity === undefined ? {} : { inventoryQuantity }),
        ...(weight === undefined ? {} : { weight }),
        ...(variant.weightUnit === undefined ? {} : { weightUnit: variant.weightUnit }),
      };
    });
  }

  private findVariantPricing(
    variant: ProductVariant,
    index: number,
    recommendations: readonly VariantPricingRecommendation[],
  ): VariantPricingRecommendation | undefined {
    const byId = recommendations.find((recommendation) => recommendation.variantId === variant.id);

    if (byId !== undefined) {
      return byId;
    }

    const sku = this.normalizeText(variant.sku).toLowerCase();

    if (sku.length > 0) {
      const bySku = recommendations.find((recommendation) => {
        return this.normalizeText(recommendation.sku).toLowerCase() === sku;
      });

      if (bySku !== undefined) {
        return bySku;
      }
    }

    return recommendations[index];
  }

  private resolveVariantPrice(
    product: NormalizedProduct,
    variant: ProductVariant,
    pricing: ProductPricingRecommendation,
    variantPricing: VariantPricingRecommendation | undefined,
  ): number {
    return (
      this.safeMoney(variantPricing?.recommendedPrice) ??
      this.safeMoney(pricing.recommendedSellingPrice) ??
      this.safeMoney(variant.suggestedPrice) ??
      this.safeMoney(product.pricing?.sellingPrice) ??
      0
    );
  }

  private resolveCompareAtPrice(
    product: NormalizedProduct,
    variant: ProductVariant,
    pricing: ProductPricingRecommendation,
    variantPricing: VariantPricingRecommendation | undefined,
    price: number,
  ): number | undefined {
    const compareAtPrice =
      this.safeMoney(variantPricing?.compareAtPrice) ??
      this.safeMoney(pricing.recommendedCompareAtPrice) ??
      this.safeMoney(variant.compareAtPrice) ??
      this.safeMoney(product.pricing?.compareAtPrice);

    return compareAtPrice !== undefined && compareAtPrice > price ? compareAtPrice : undefined;
  }

  private buildSeo(copy: ProductCopy, title: string): ShopifyProductPayloadSeo {
    const seoTitle = this.truncateAtWord(this.normalizeSeoText(copy.seoTitle) || title, SEO_TITLE_LIMIT);
    const seoDescription = this.truncateAtWord(
      this.normalizeSeoText(copy.seoDescription) || this.normalizeSeoText(copy.shortDescription),
      SEO_DESCRIPTION_LIMIT,
    );

    return {
      ...(seoTitle.length > 0 ? { title: seoTitle } : {}),
      ...(seoDescription.length > 0 ? { description: seoDescription } : {}),
    };
  }

  private normalizeOptionValues(values: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
    const normalized: Record<string, string> = {};

    for (const [name, value] of Object.entries(values)) {
      const normalizedName = this.normalizeText(name);
      const normalizedValue = this.normalizeText(value);

      if (normalizedName.length > 0 && normalizedValue.length > 0) {
        normalized[normalizedName] = normalizedValue;
      }
    }

    return normalized;
  }

  private firstMeaningfulValue(values: readonly (string | undefined)[]): string | undefined {
    for (const value of values) {
      const normalized = this.normalizeTitle(value);

      if (this.isMeaningfulValue(normalized)) {
        return normalized;
      }
    }

    return undefined;
  }

  private normalizeTitle(value: string | undefined): string {
    return this.truncateAtWord(
      this.normalizeText(value)
        .replace(/[!]{2,}/gu, "!")
        .replace(/[?]{2,}/gu, "?")
        .replace(/[.]{3,}/gu, ".")
        .replace(/[-_]{2,}/gu, " "),
      TITLE_LIMIT,
    );
  }

  private normalizeSeoText(value: string): string {
    return this.normalizeText(value).replace(/[<>]/gu, "");
  }

  private normalizeParagraphs(value: string): readonly string[] {
    return this.normalizeLineEndings(value)
      .split(/\n{2,}/u)
      .map((paragraph) => this.normalizeText(paragraph))
      .filter((paragraph) => paragraph.length > 0);
  }

  private normalizeList(values: readonly string[]): readonly string[] {
    return this.uniqueValues(values.map((value) => this.normalizeText(value)));
  }

  private uniqueValues(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const value of values) {
      const normalized = this.normalizeText(value);
      const key = normalized.toLowerCase();

      if (normalized.length > 0 && !seen.has(key)) {
        seen.add(key);
        unique.push(normalized);
      }
    }

    return unique;
  }

  private normalizeText(value: string | undefined): string {
    return this.normalizeLineEndings(value ?? "")
      .replace(/\s+/gu, " ")
      .replace(/\s+([,.!?;:])/gu, "$1")
      .trim();
  }

  private normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/gu, "\n").replace(/\n{3,}/gu, "\n\n").trim();
  }

  private toKebabCase(value: string): string {
    return this.normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "");
  }

  private truncateAtWord(value: string, limit: number): string {
    const normalized = this.normalizeText(value);

    if (normalized.length <= limit) {
      return normalized;
    }

    const truncated = normalized.slice(0, limit).trim();
    const lastSpace = truncated.lastIndexOf(" ");

    return (lastSpace >= Math.floor(limit * 0.65) ? truncated.slice(0, lastSpace) : truncated).trim();
  }

  private safeMoney(value: number | undefined): number | undefined {
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      return undefined;
    }

    const normalized = Math.round(value * 100) / 100;
    return Object.is(normalized, -0) ? 0 : normalized;
  }

  private safeInventory(value: number | undefined): number | undefined {
    if (value === undefined || !Number.isFinite(value)) {
      return undefined;
    }

    return Math.max(0, Math.floor(value));
  }

  private isMeaningfulValue(value: string | undefined): value is string {
    const normalized = this.normalizeText(value).toLowerCase();
    return normalized.length > 0 && !PLACEHOLDER_VALUES.has(normalized);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/gu, "&amp;")
      .replace(/</gu, "&lt;")
      .replace(/>/gu, "&gt;")
      .replace(/"/gu, "&quot;")
      .replace(/'/gu, "&#39;");
  }
}
