import { AppError } from "../../../../shared/errors/app-error.js";
import type {
  ProductImportSourcePlatform,
  SupplierProductImportInput,
  SupplierProductImportVariantInput,
} from "../../domain/models/product-import.model.js";
import type { ProductCurrency, RawProductInput } from "../../../ai-product/types/product.types.js";

export interface ProductImportValidationIssue {
  readonly code: string;
  readonly field: string;
  readonly message: string;
}

const SUPPORTED_CURRENCIES = new Set(["USD", "GBP", "AUD", "CAD", "MYR", "EUR"]);

const optionalField = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> => (value === undefined ? {} : ({ [key]: value } as Record<Key, Value>));

export class ProductImportInputValidator {
  public validate(input: SupplierProductImportInput): RawProductInput {
    const issues = this.collectIssues(input);

    if (issues.length > 0) {
      throw AppError.badRequest(
        "Product import input failed validation.",
        { issues },
        "PRODUCT_IMPORT_VALIDATION_FAILED",
      );
    }

    return this.toRawProductInput(input);
  }

  private collectIssues(input: SupplierProductImportInput): readonly ProductImportValidationIssue[] {
    const issues: ProductImportValidationIssue[] = [];

    this.requiredText(input.externalProductId, "externalProductId", "EXTERNAL_PRODUCT_ID_REQUIRED", issues);
    this.requiredText(input.sourcePlatform, "sourcePlatform", "SOURCE_PLATFORM_REQUIRED", issues);
    this.requiredText(input.title, "title", "TITLE_REQUIRED", issues);
    this.validateCurrency(input.currency, "currency", issues);

    if (input.variants.length === 0) {
      issues.push({ code: "VARIANTS_REQUIRED", field: "variants", message: "At least one variant is required." });
    }

    input.images.forEach((image, index) => {
      this.requiredText(image.url, `images.${index}.url`, "IMAGE_URL_REQUIRED", issues);
      if (this.hasText(image.url) && !image.url.trim().toLowerCase().startsWith("https://")) {
        issues.push({ code: "IMAGE_URL_INSECURE", field: `images.${index}.url`, message: "Image URL must use https." });
      }
    });

    input.variants.forEach((variant, index) => this.validateVariant(variant, input.currency, index, issues));

    if (input.estimatedDelivery?.minDays !== undefined && input.estimatedDelivery.minDays < 0) {
      issues.push({ code: "DELIVERY_MIN_INVALID", field: "estimatedDelivery.minDays", message: "Minimum delivery days must be non-negative." });
    }

    if (input.estimatedDelivery?.maxDays !== undefined && input.estimatedDelivery.maxDays < 0) {
      issues.push({ code: "DELIVERY_MAX_INVALID", field: "estimatedDelivery.maxDays", message: "Maximum delivery days must be non-negative." });
    }

    if (
      input.estimatedDelivery?.minDays !== undefined &&
      input.estimatedDelivery.maxDays !== undefined &&
      input.estimatedDelivery.minDays > input.estimatedDelivery.maxDays
    ) {
      issues.push({ code: "DELIVERY_RANGE_INVALID", field: "estimatedDelivery", message: "Delivery minimum cannot exceed maximum." });
    }

    return issues;
  }

  private validateVariant(
    variant: SupplierProductImportVariantInput,
    fallbackCurrency: ProductCurrency,
    index: number,
    issues: ProductImportValidationIssue[],
  ): void {
    const field = `variants.${index}`;
    const currency = variant.currency ?? fallbackCurrency;

    this.validateCurrency(currency, `${field}.currency`, issues);

    if (variant.supplierPrice !== undefined && (!Number.isFinite(variant.supplierPrice) || variant.supplierPrice < 0)) {
      issues.push({ code: "SUPPLIER_PRICE_INVALID", field: `${field}.supplierPrice`, message: "Supplier price must be non-negative." });
    }

    if (variant.compareAtPrice !== undefined && (!Number.isFinite(variant.compareAtPrice) || variant.compareAtPrice < 0)) {
      issues.push({ code: "COMPARE_AT_PRICE_INVALID", field: `${field}.compareAtPrice`, message: "Compare-at price must be non-negative." });
    }

    if (variant.inventory !== undefined && (!Number.isInteger(variant.inventory) || variant.inventory < 0)) {
      issues.push({ code: "INVENTORY_INVALID", field: `${field}.inventory`, message: "Inventory must be a non-negative integer." });
    }
  }

  private toRawProductInput(input: SupplierProductImportInput): RawProductInput {
    const source = this.toProductSource(input.sourcePlatform);
    const variants = input.variants.map((variant, index) => {
      const optionValues = this.normalizeOptionValues(variant.optionValues);
      const title = this.normalizeText(variant.title) ?? this.variantTitle(optionValues, index);
      const supplierPrice = variant.supplierPrice ?? input.supplierPrice ?? 0;
      const compareAtPrice = variant.compareAtPrice ?? input.compareAtPrice;
      const suggestedPrice = compareAtPrice !== undefined ? Math.max(compareAtPrice * 0.8, supplierPrice) : supplierPrice;

      return {
        id: this.normalizeText(variant.externalVariantId) ?? `variant:${input.externalProductId}:${index + 1}`,
        ...optionalField("supplierVariantId", this.normalizeText(variant.externalVariantId)),
        sku: this.normalizeText(variant.sku) ?? `${this.toKey(input.sourcePlatform)}-${this.toKey(input.externalProductId)}-${index + 1}`.toUpperCase(),
        title,
        optionValues,
        ...optionalField("cost", supplierPrice),
        ...optionalField("suggestedPrice", suggestedPrice),
        ...(compareAtPrice === undefined ? {} : { compareAtPrice }),
        currency: variant.currency ?? input.currency,
        ...optionalField("inventoryQuantity", variant.inventory ?? input.inventory ?? 0),
        ...optionalField("weight", variant.weight),
        ...optionalField("weightUnit", variant.weightUnit),
        ...optionalField("imageUrl", this.normalizeText(variant.imageUrl)),
        available: variant.available ?? (variant.inventory === undefined || variant.inventory > 0),
      };
    });

    return {
      source,
      ...optionalField("externalId", input.externalProductId),
      title: input.title,
      ...optionalField("description", input.description),
      ...optionalField("productUrl", input.supplierUrl),
      supplier: {
        source,
        ...optionalField("supplierName", input.supplierName),
        ...optionalField("supplierProductId", input.externalProductId),
        ...optionalField("supplierProductUrl", input.supplierUrl),
        ...optionalField("shippingOrigin", input.shippingOrigin),
        ...optionalField("estimatedDeliveryDaysMin", input.estimatedDelivery?.minDays),
        ...optionalField("estimatedDeliveryDaysMax", input.estimatedDelivery?.maxDays),
      },
      images: input.images.map((image, index) => ({
        id: `image:${this.toKey(input.sourcePlatform)}:${this.toKey(input.externalProductId)}:${index + 1}`,
        url: image.url,
        ...optionalField("altText", image.altText),
        ...optionalField("position", image.position ?? index + 1),
        ...optionalField("width", image.width),
        ...optionalField("height", image.height),
        isPrimary: image.isPrimary ?? index === 0,
      })),
      options: this.toOptions(variants.map((variant) => variant.optionValues)),
      variants,
      tags: input.tags,
      ...optionalField("category", input.category),
      ...optionalField("brand", input.brand),
      targetMarkets: this.toTargetMarkets(input.shippingDestinations),
      metadata: {
        ...input.rawMetadata,
        productType: input.productType,
        shippingDestinations: [...input.shippingDestinations],
      },
      capturedAt: new Date(),
    };
  }

  private toOptions(values: readonly Readonly<Record<string, string>>[]): RawProductInput["options"] {
    const optionValuesByName = new Map<string, Set<string>>();

    for (const valueSet of values) {
      for (const [name, value] of Object.entries(valueSet)) {
        const existing = optionValuesByName.get(name) ?? new Set<string>();
        existing.add(value);
        optionValuesByName.set(name, existing);
      }
    }

    if (optionValuesByName.size === 0) {
      return [{ name: "Title", values: ["Default Title"] }];
    }

    return [...optionValuesByName.entries()].map(([name, optionValues]) => ({ name, values: [...optionValues] }));
  }

  private normalizeOptionValues(values: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> {
    const entries = Object.entries(values ?? {})
      .map(([key, value]) => [this.normalizeText(key), this.normalizeText(value)] as const)
      .filter((entry): entry is readonly [string, string] => entry[0] !== undefined && entry[1] !== undefined);

    return entries.length > 0 ? Object.fromEntries(entries) : { Title: "Default Title" };
  }

  private toTargetMarkets(destinations: readonly string[]): RawProductInput["targetMarkets"] {
    const normalized = destinations.map((destination) => destination.trim().toUpperCase());
    const markets = normalized.filter((destination): destination is RawProductInput["targetMarkets"][number] =>
      ["US", "UK", "AU", "CA", "MY", "EU", "GLOBAL"].includes(destination),
    );

    return markets.length > 0 ? markets : ["GLOBAL"];
  }

  private toProductSource(platform: ProductImportSourcePlatform): RawProductInput["source"] {
    if (["autods", "winninghunter", "manual", "shopify", "aliexpress", "cjdropshipping", "zendrop", "dsers", "usadrop", "other"].includes(platform)) {
      return platform as RawProductInput["source"];
    }

    return "other";
  }

  private variantTitle(optionValues: Readonly<Record<string, string>>, index: number): string {
    const title = Object.values(optionValues).join(" / ").trim();
    return title.length > 0 ? title : `Variant ${index + 1}`;
  }

  private validateCurrency(currency: ProductCurrency | undefined, field: string, issues: ProductImportValidationIssue[]): void {
    if (!this.hasText(currency) || !SUPPORTED_CURRENCIES.has(currency.trim().toUpperCase())) {
      issues.push({ code: "UNSUPPORTED_CURRENCY", field, message: "Currency is not supported for product import." });
    }
  }

  private requiredText(value: string | undefined, field: string, code: string, issues: ProductImportValidationIssue[]): void {
    if (!this.hasText(value)) {
      issues.push({ code, field, message: "Value is required." });
    }
  }

  private normalizeText(value: string | undefined): string | undefined {
    const normalized = value?.trim().replace(/\s+/gu, " ");
    return normalized === undefined || normalized.length === 0 ? undefined : normalized;
  }

  private hasText(value: string | undefined): value is string {
    return value !== undefined && value.trim().length > 0;
  }

  private toKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown";
  }
}
