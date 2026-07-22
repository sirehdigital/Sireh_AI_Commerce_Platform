import type {
  CreateProductDraftDto,
  CreateProductDraftImageDto,
  CreateProductDraftSupplierReferenceDto,
  CreateProductDraftVariantDto,
  CreateProductDraftWeightUnit,
} from "../../application/dto/create-product-draft.dto.js";
import type {
  ProductDraft,
  ProductDraftAiMetadata,
  ProductDraftBranding,
  ProductDraftImage,
  ProductDraftMoney,
  ProductDraftRiskAssessment,
  ProductDraftSeo,
  ProductDraftShippingEstimate,
  ProductDraftSourceType,
  ProductDraftVariant,
} from "../models/product-draft.model.js";

export type ProductDraftIdGenerator = () => string;

export type ProductDraftClock = () => string;

export interface ProductDraftValidationIssue {
  readonly code: string;
  readonly field: string;
  readonly message: string;
}

export class ProductDraftValidationError extends Error {
  public static readonly errorCode = "PRODUCT_DRAFT_VALIDATION_FAILED";

  public readonly code = ProductDraftValidationError.errorCode;
  public readonly issues: readonly ProductDraftValidationIssue[];

  public constructor(issues: readonly ProductDraftValidationIssue[]) {
    super("Product Draft validation failed.");
    this.name = "ProductDraftValidationError";
    this.issues = issues.map((issue) => ({ ...issue }));
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ProductDraftFactoryDependencies {
  readonly idGenerator: ProductDraftIdGenerator;
  readonly clock: ProductDraftClock;
}

const MAX_TITLE_LENGTH = 180;
const MAX_DESCRIPTION_LENGTH = 20_000;
const VALID_SOURCE_TYPES: readonly ProductDraftSourceType[] = ["manual", "autods", "supplier", "ai", "import", "migration"];
const VALID_WEIGHT_UNITS: readonly CreateProductDraftWeightUnit[] = ["g", "kg", "lb", "oz"];

export class ProductDraftFactory {
  public static create(input: CreateProductDraftDto, dependencies: ProductDraftFactoryDependencies): ProductDraft {
    const issues = this.collectValidationIssues(input, dependencies);

    if (issues.length > 0) {
      throw new ProductDraftValidationError(issues);
    }

    const draftId = this.normalizeRequiredText(dependencies.idGenerator());
    const now = this.normalizeRequiredText(dependencies.clock());
    const requestedAt = this.normalizeRequiredText(input.request.requestedAt);
    const importedAt = this.normalizeOptionalText(input.sourceReference.importedAt) ?? requestedAt;
    const images = this.mapImages(input.images);

    return {
      id: draftId,
      status: "draft",
      version: 1,
      source: {
        sourceType: input.sourceType,
        sourceId: this.normalizeRequiredText(input.sourceReference.sourceId),
        ...this.optionalString("supplierId", input.supplier?.supplierId),
        ...this.optionalString("supplierProductId", input.supplier?.supplierProductId),
        importedAt,
      },
      title: this.normalizeRequiredText(input.title),
      description: this.normalizeRequiredText(input.description),
      ...this.optionalString("productType", input.productType),
      ...this.optionalString("vendor", input.vendor),
      tags: this.normalizeUniqueTextCollection(input.tags),
      targetMarkets: this.normalizeUniqueTextCollection(input.targetMarkets),
      images,
      variants: this.mapVariants(input.variants, draftId),
      ...this.optionalShipping(input.shippingEstimate),
      ...this.optionalSeo(input.seo),
      ...this.optionalBranding(input.branding),
      ...this.optionalRiskAssessment(input.riskAssessment),
      ...this.optionalAi(input.ai),
      createdAt: now,
      updatedAt: now,
    };
  }

  private static collectValidationIssues(
    input: CreateProductDraftDto,
    dependencies: ProductDraftFactoryDependencies,
  ): ProductDraftValidationIssue[] {
    const issues: ProductDraftValidationIssue[] = [];

    this.validateGeneratedValue(dependencies.idGenerator(), "idGenerator", "INVALID_GENERATED_ID", issues);
    this.validateDateValue(dependencies.clock(), "clock", "INVALID_CLOCK_TIMESTAMP", issues);
    this.validateSource(input, issues);
    this.validateCoreContent(input, issues);
    this.validateImages(input.images, issues);
    this.validateVariants(input.variants, issues);
    this.validateRequestMetadata(input, issues);
    this.validateShippingEstimate(input.shippingEstimate, issues);
    this.validateSeo(input.seo, issues);
    this.validateBranding(input.branding, issues);
    this.validateRiskAssessment(input.riskAssessment, issues);
    this.validateAiMetadata(input.ai, issues);

    return issues;
  }

  private static validateSource(input: CreateProductDraftDto, issues: ProductDraftValidationIssue[]): void {
    if (!VALID_SOURCE_TYPES.includes(input.sourceType)) {
      this.addIssue(issues, "INVALID_SOURCE_TYPE", "sourceType", "Source type is not supported.");
    }

    this.validateRequiredText(input.sourceReference.sourceId, "sourceReference.sourceId", "SOURCE_ID_REQUIRED", issues);
    this.validateOptionalText(
      input.sourceReference.sourceName,
      "sourceReference.sourceName",
      "SOURCE_NAME_EMPTY",
      issues,
    );
    this.validateOptionalDateValue(
      input.sourceReference.importedAt,
      "sourceReference.importedAt",
      "SOURCE_IMPORTED_AT_INVALID",
      issues,
    );
    this.validateSupplier(input.supplier, issues);
    this.validateOptionalText(input.externalCorrelationId, "externalCorrelationId", "EXTERNAL_CORRELATION_ID_EMPTY", issues);
  }

  private static validateSupplier(
    supplier: CreateProductDraftSupplierReferenceDto | undefined,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (supplier === undefined) {
      return;
    }

    this.validateOptionalText(supplier.supplierId, "supplier.supplierId", "SUPPLIER_ID_EMPTY", issues);
    this.validateOptionalText(supplier.supplierName, "supplier.supplierName", "SUPPLIER_NAME_EMPTY", issues);
    this.validateOptionalText(
      supplier.supplierProductId,
      "supplier.supplierProductId",
      "SUPPLIER_PRODUCT_ID_EMPTY",
      issues,
    );
    this.validateOptionalText(supplier.marketplace, "supplier.marketplace", "SUPPLIER_MARKETPLACE_EMPTY", issues);
  }

  private static validateCoreContent(input: CreateProductDraftDto, issues: ProductDraftValidationIssue[]): void {
    this.validateRequiredText(input.title, "title", "TITLE_REQUIRED", issues);
    this.validateRequiredText(input.description, "description", "DESCRIPTION_REQUIRED", issues);

    if (this.normalizeOptionalText(input.title) !== undefined && input.title.trim().length > MAX_TITLE_LENGTH) {
      this.addIssue(issues, "TITLE_TOO_LONG", "title", "Title exceeds the maximum allowed length.");
    }

    if (
      this.normalizeOptionalText(input.description) !== undefined &&
      input.description.trim().length > MAX_DESCRIPTION_LENGTH
    ) {
      this.addIssue(issues, "DESCRIPTION_TOO_LONG", "description", "Description exceeds the maximum allowed length.");
    }

    this.validateOptionalText(input.vendor, "vendor", "VENDOR_EMPTY", issues);
    this.validateOptionalText(input.productType, "productType", "PRODUCT_TYPE_EMPTY", issues);
    this.validateTextCollection(input.tags, "tags", "TAG_EMPTY", issues);
    this.validateTextCollection(input.targetMarkets, "targetMarkets", "TARGET_MARKET_EMPTY", issues);
  }

  private static validateImages(
    images: readonly CreateProductDraftImageDto[],
    issues: ProductDraftValidationIssue[],
  ): void {
    images.forEach((image, index) => {
      const field = `images.${index}`;
      const normalizedUrl = this.normalizeOptionalText(image.url);

      if (normalizedUrl === undefined) {
        this.addIssue(issues, "IMAGE_URL_REQUIRED", `${field}.url`, "Image URL is required.");
      } else if (!normalizedUrl.toLowerCase().startsWith("https://")) {
        this.addIssue(issues, "IMAGE_URL_INSECURE", `${field}.url`, "Image URL must use https.");
      }

      this.validateOptionalText(image.altText, `${field}.altText`, "IMAGE_ALT_TEXT_EMPTY", issues);

      if (image.position !== undefined && (!Number.isInteger(image.position) || image.position <= 0)) {
        this.addIssue(issues, "IMAGE_POSITION_INVALID", `${field}.position`, "Image position must be a positive integer.");
      }
    });
  }

  private static validateVariants(
    variants: readonly CreateProductDraftVariantDto[],
    issues: ProductDraftValidationIssue[],
  ): void {
    if (variants.length === 0) {
      this.addIssue(issues, "VARIANTS_REQUIRED", "variants", "At least one variant is required.");
    }

    const seenSkus = new Set<string>();

    variants.forEach((variant, index) => {
      const field = `variants.${index}`;
      const sku = this.normalizeOptionalText(variant.sku);

      this.validateOptionalText(variant.sourceVariantId, `${field}.sourceVariantId`, "SOURCE_VARIANT_ID_EMPTY", issues);
      this.validateRequiredText(variant.title, `${field}.title`, "VARIANT_TITLE_REQUIRED", issues);
      this.validateRequiredText(variant.sku, `${field}.sku`, "VARIANT_SKU_REQUIRED", issues);

      if (sku !== undefined) {
        const skuKey = sku.toLowerCase();

        if (seenSkus.has(skuKey)) {
          this.addIssue(issues, "VARIANT_SKU_DUPLICATE", `${field}.sku`, "Variant SKU values must be unique.");
        }

        seenSkus.add(skuKey);
      }

      this.validateMoney(variant.price, `${field}.price`, "PRICE", issues);
      this.validateOptionalMoney(variant.compareAtPrice, `${field}.compareAtPrice`, "COMPARE_AT_PRICE", issues);
      this.validateOptionalMoney(variant.cost, `${field}.cost`, "COST", issues);

      if (
        variant.compareAtPrice !== undefined &&
        this.isValidMoney(variant.price) &&
        this.isValidMoney(variant.compareAtPrice) &&
        variant.compareAtPrice.amount < variant.price.amount
      ) {
        this.addIssue(
          issues,
          "COMPARE_AT_PRICE_BELOW_PRICE",
          `${field}.compareAtPrice`,
          "Compare-at price cannot be lower than selling price.",
        );
      }

      if (
        variant.inventoryQuantity !== undefined &&
        (!Number.isInteger(variant.inventoryQuantity) || variant.inventoryQuantity < 0)
      ) {
        this.addIssue(
          issues,
          "INVENTORY_QUANTITY_INVALID",
          `${field}.inventoryQuantity`,
          "Inventory quantity must be a non-negative integer.",
        );
      }

      this.validateOptionalText(variant.barcode, `${field}.barcode`, "VARIANT_BARCODE_EMPTY", issues);
      this.validateTextCollection(
        variant.optionValues.map((option) => option.name),
        `${field}.optionValues.name`,
        "OPTION_NAME_EMPTY",
        issues,
      );
      this.validateTextCollection(
        variant.optionValues.map((option) => option.value),
        `${field}.optionValues.value`,
        "OPTION_VALUE_EMPTY",
        issues,
      );

      if (variant.weight !== undefined && (!Number.isFinite(variant.weight) || variant.weight < 0)) {
        this.addIssue(issues, "WEIGHT_INVALID", `${field}.weight`, "Variant weight must be non-negative.");
      }

      if (variant.weightUnit !== undefined && !VALID_WEIGHT_UNITS.includes(variant.weightUnit)) {
        this.addIssue(issues, "WEIGHT_UNIT_INVALID", `${field}.weightUnit`, "Variant weight unit is not supported.");
      }
    });
  }

  private static validateRequestMetadata(input: CreateProductDraftDto, issues: ProductDraftValidationIssue[]): void {
    this.validateRequiredText(input.request.requestedBy, "request.requestedBy", "REQUESTED_BY_REQUIRED", issues);
    this.validateDateValue(input.request.requestedAt, "request.requestedAt", "REQUESTED_AT_INVALID", issues);
    this.validateOptionalText(input.request.correlationId, "request.correlationId", "CORRELATION_ID_EMPTY", issues);
    this.validateOptionalText(input.request.idempotencyKey, "request.idempotencyKey", "IDEMPOTENCY_KEY_EMPTY", issues);
  }

  private static validateShippingEstimate(
    shippingEstimate: ProductDraftShippingEstimate | undefined,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (shippingEstimate === undefined) {
      return;
    }

    if (!Number.isInteger(shippingEstimate.minimumDeliveryDays) || shippingEstimate.minimumDeliveryDays < 0) {
      this.addIssue(
        issues,
        "SHIPPING_MINIMUM_DAYS_INVALID",
        "shippingEstimate.minimumDeliveryDays",
        "Minimum delivery days must be a non-negative integer.",
      );
    }

    if (!Number.isInteger(shippingEstimate.maximumDeliveryDays) || shippingEstimate.maximumDeliveryDays < 0) {
      this.addIssue(
        issues,
        "SHIPPING_MAXIMUM_DAYS_INVALID",
        "shippingEstimate.maximumDeliveryDays",
        "Maximum delivery days must be a non-negative integer.",
      );
    }

    if (shippingEstimate.minimumDeliveryDays > shippingEstimate.maximumDeliveryDays) {
      this.addIssue(
        issues,
        "SHIPPING_RANGE_INVALID",
        "shippingEstimate.maximumDeliveryDays",
        "Maximum delivery days cannot be lower than minimum delivery days.",
      );
    }

    this.validateOptionalText(
      shippingEstimate.shipsFromCountry,
      "shippingEstimate.shipsFromCountry",
      "SHIPPING_ORIGIN_EMPTY",
      issues,
    );
    this.validateTextCollection(
      shippingEstimate.shipsToCountries,
      "shippingEstimate.shipsToCountries",
      "SHIPPING_DESTINATION_EMPTY",
      issues,
    );
  }

  private static validateSeo(seo: ProductDraftSeo | undefined, issues: ProductDraftValidationIssue[]): void {
    if (seo === undefined) {
      return;
    }

    this.validateOptionalText(seo.title, "seo.title", "SEO_TITLE_EMPTY", issues);
    this.validateOptionalText(seo.description, "seo.description", "SEO_DESCRIPTION_EMPTY", issues);
    this.validateOptionalText(seo.handle, "seo.handle", "SEO_HANDLE_EMPTY", issues);
  }

  private static validateBranding(
    branding: ProductDraftBranding | undefined,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (branding === undefined) {
      return;
    }

    this.validateOptionalText(branding.brandName, "branding.brandName", "BRANDING_BRAND_NAME_EMPTY", issues);
    this.validateOptionalText(branding.productName, "branding.productName", "BRANDING_PRODUCT_NAME_EMPTY", issues);
    this.validateOptionalText(
      branding.collectionName,
      "branding.collectionName",
      "BRANDING_COLLECTION_NAME_EMPTY",
      issues,
    );
    this.validateOptionalText(branding.positioning, "branding.positioning", "BRANDING_POSITIONING_EMPTY", issues);
    this.validateTextCollection(
      branding.targetAudience,
      "branding.targetAudience",
      "BRANDING_TARGET_AUDIENCE_EMPTY",
      issues,
    );
    this.validateOptionalText(
      branding.valueProposition,
      "branding.valueProposition",
      "BRANDING_VALUE_PROPOSITION_EMPTY",
      issues,
    );
  }

  private static validateRiskAssessment(
    riskAssessment: ProductDraftRiskAssessment | undefined,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (riskAssessment === undefined) {
      return;
    }

    if (!["unknown", "low", "medium", "high", "critical"].includes(riskAssessment.level)) {
      this.addIssue(issues, "RISK_LEVEL_INVALID", "riskAssessment.level", "Risk level is not supported.");
    }

    if (riskAssessment.score !== undefined && (!Number.isFinite(riskAssessment.score) || riskAssessment.score < 0)) {
      this.addIssue(issues, "RISK_SCORE_INVALID", "riskAssessment.score", "Risk score must be non-negative.");
    }

    this.validateTextCollection(riskAssessment.reasons, "riskAssessment.reasons", "RISK_REASON_EMPTY", issues);
    this.validateTextCollection(
      riskAssessment.restrictedClaims,
      "riskAssessment.restrictedClaims",
      "RISK_RESTRICTED_CLAIM_EMPTY",
      issues,
    );
    this.validateOptionalDateValue(
      riskAssessment.assessedAt,
      "riskAssessment.assessedAt",
      "RISK_ASSESSED_AT_INVALID",
      issues,
    );
  }

  private static validateAiMetadata(ai: ProductDraftAiMetadata | undefined, issues: ProductDraftValidationIssue[]): void {
    if (ai === undefined) {
      return;
    }

    this.validateOptionalDateValue(ai.lastProcessedAt, "ai.lastProcessedAt", "AI_LAST_PROCESSED_AT_INVALID", issues);
    this.validateOptionalText(ai.modelReference, "ai.modelReference", "AI_MODEL_REFERENCE_EMPTY", issues);
  }

  private static mapImages(images: readonly CreateProductDraftImageDto[]): readonly ProductDraftImage[] {
    const seenUrls = new Set<string>();
    const allImagesHavePositions = images.every((image) => image.position !== undefined);
    const mappedImages: ProductDraftImage[] = [];

    images.forEach((image, index) => {
      const sourceUrl = this.normalizeRequiredText(image.url);
      const dedupeKey = sourceUrl.toLowerCase();

      if (seenUrls.has(dedupeKey)) {
        return;
      }

      seenUrls.add(dedupeKey);
      mappedImages.push({
        sourceUrl,
        ...this.optionalString("altText", image.altText),
        position: image.position ?? index + 1,
        selected: true,
        primary: mappedImages.length === 0,
      });
    });

    return allImagesHavePositions
      ? [...mappedImages].sort((first, second) => first.position - second.position)
      : mappedImages;
  }

  private static mapVariants(variants: readonly CreateProductDraftVariantDto[], draftId: string): readonly ProductDraftVariant[] {
    return variants.map((variant, index) => {
      const inventoryQuantity = variant.inventoryQuantity;

      return {
        id: `${draftId}:variant:${index + 1}`,
        ...this.optionalString("sourceVariantId", variant.sourceVariantId),
        title: this.normalizeRequiredText(variant.title),
        sku: this.normalizeRequiredText(variant.sku),
        ...this.optionalString("barcode", variant.barcode),
        options: variant.optionValues.map((option) => ({
          name: this.normalizeRequiredText(option.name),
          value: this.normalizeRequiredText(option.value),
        })),
        supplierPrice: this.cloneMoney(variant.cost ?? { amount: 0, currency: variant.price.currency }),
        sellingPrice: this.cloneMoney(variant.price),
        ...(variant.compareAtPrice === undefined ? {} : { compareAtPrice: this.cloneMoney(variant.compareAtPrice) }),
        ...(inventoryQuantity === undefined ? {} : { inventoryQuantity }),
        available: inventoryQuantity === undefined || inventoryQuantity > 0,
        ...(variant.weight === undefined ? {} : { weightGrams: this.toWeightGrams(variant.weight, variant.weightUnit) }),
      };
    });
  }

  private static optionalShipping(
    shippingEstimate: ProductDraftShippingEstimate | undefined,
  ): Pick<ProductDraft, "shipping"> | Record<string, never> {
    if (shippingEstimate === undefined) {
      return {};
    }

    return {
      shipping: {
        minimumDeliveryDays: shippingEstimate.minimumDeliveryDays,
        maximumDeliveryDays: shippingEstimate.maximumDeliveryDays,
        ...this.optionalString("shipsFromCountry", shippingEstimate.shipsFromCountry),
        shipsToCountries: this.normalizeUniqueTextCollection(shippingEstimate.shipsToCountries),
      },
    };
  }

  private static optionalSeo(seo: ProductDraftSeo | undefined): Pick<ProductDraft, "seo"> | Record<string, never> {
    if (seo === undefined) {
      return {};
    }

    const normalizedSeo: ProductDraftSeo = {
      ...this.optionalString("title", seo.title),
      ...this.optionalString("description", seo.description),
      ...this.optionalString("handle", seo.handle),
    };

    return { seo: normalizedSeo };
  }

  private static optionalBranding(
    branding: ProductDraftBranding | undefined,
  ): Pick<ProductDraft, "branding"> | Record<string, never> {
    if (branding === undefined) {
      return {};
    }

    return {
      branding: {
        ...this.optionalString("brandName", branding.brandName),
        ...this.optionalString("productName", branding.productName),
        ...this.optionalString("collectionName", branding.collectionName),
        ...this.optionalString("positioning", branding.positioning),
        targetAudience: this.normalizeUniqueTextCollection(branding.targetAudience),
        ...this.optionalString("valueProposition", branding.valueProposition),
      },
    };
  }

  private static optionalRiskAssessment(
    riskAssessment: ProductDraftRiskAssessment | undefined,
  ): Pick<ProductDraft, "riskAssessment"> | Record<string, never> {
    if (riskAssessment === undefined) {
      return {};
    }

    return {
      riskAssessment: {
        level: riskAssessment.level,
        ...(riskAssessment.score === undefined ? {} : { score: riskAssessment.score }),
        reasons: this.normalizeUniqueTextCollection(riskAssessment.reasons),
        restrictedClaims: this.normalizeUniqueTextCollection(riskAssessment.restrictedClaims),
        ...this.optionalString("assessedAt", riskAssessment.assessedAt),
      },
    };
  }

  private static optionalAi(ai: ProductDraftAiMetadata | undefined): Pick<ProductDraft, "ai"> | Record<string, never> {
    if (ai === undefined) {
      return {};
    }

    return {
      ai: {
        analyzed: ai.analyzed,
        branded: ai.branded,
        copyGenerated: ai.copyGenerated,
        pricingRecommended: ai.pricingRecommended,
        riskAssessed: ai.riskAssessed,
        ...this.optionalString("lastProcessedAt", ai.lastProcessedAt),
        ...this.optionalString("modelReference", ai.modelReference),
      },
    };
  }

  private static validateGeneratedValue(
    value: string,
    field: string,
    code: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (this.normalizeOptionalText(value) === undefined) {
      this.addIssue(issues, code, field, "Generated value must be non-empty.");
    }
  }

  private static validateDateValue(
    value: string,
    field: string,
    code: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (this.normalizeOptionalText(value) === undefined || !this.isValidDateValue(value)) {
      this.addIssue(issues, code, field, "Date value must be valid.");
    }
  }

  private static validateOptionalDateValue(
    value: string | undefined,
    field: string,
    code: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (value !== undefined && (this.normalizeOptionalText(value) === undefined || !this.isValidDateValue(value))) {
      this.addIssue(issues, code, field, "Date value must be valid when supplied.");
    }
  }

  private static validateRequiredText(
    value: string | undefined,
    field: string,
    code: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (this.normalizeOptionalText(value) === undefined) {
      this.addIssue(issues, code, field, "Value must be non-empty.");
    }
  }

  private static validateOptionalText(
    value: string | undefined,
    field: string,
    code: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (value !== undefined && this.normalizeOptionalText(value) === undefined) {
      this.addIssue(issues, code, field, "Value must be non-empty when supplied.");
    }
  }

  private static validateTextCollection(
    values: readonly string[],
    field: string,
    code: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    values.forEach((value, index) => {
      if (this.normalizeOptionalText(value) === undefined) {
        this.addIssue(issues, code, `${field}.${index}`, "Collection values must be non-empty.");
      }
    });
  }

  private static validateMoney(
    money: ProductDraftMoney,
    field: string,
    codePrefix: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (!Number.isFinite(money.amount) || money.amount < 0) {
      this.addIssue(issues, `${codePrefix}_AMOUNT_INVALID`, `${field}.amount`, "Money amount must be non-negative.");
    }

    if (!/^[A-Z]{3}$/u.test(money.currency)) {
      this.addIssue(
        issues,
        `${codePrefix}_CURRENCY_INVALID`,
        `${field}.currency`,
        "Money currency must be an uppercase three-letter code.",
      );
    }
  }

  private static validateOptionalMoney(
    money: ProductDraftMoney | undefined,
    field: string,
    codePrefix: string,
    issues: ProductDraftValidationIssue[],
  ): void {
    if (money !== undefined) {
      this.validateMoney(money, field, codePrefix, issues);
    }
  }

  private static isValidMoney(money: ProductDraftMoney): boolean {
    return Number.isFinite(money.amount) && money.amount >= 0 && /^[A-Z]{3}$/u.test(money.currency);
  }

  private static normalizeUniqueTextCollection(values: readonly string[]): readonly string[] {
    const normalizedValues: string[] = [];
    const seenValues = new Set<string>();

    for (const value of values) {
      const normalizedValue = this.normalizeOptionalText(value);

      if (normalizedValue === undefined) {
        continue;
      }

      const key = normalizedValue.toLowerCase();

      if (!seenValues.has(key)) {
        seenValues.add(key);
        normalizedValues.push(normalizedValue);
      }
    }

    return normalizedValues;
  }

  private static normalizeRequiredText(value: string | undefined): string {
    return this.normalizeOptionalText(value) ?? "";
  }

  private static normalizeOptionalText(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();

    return normalizedValue === undefined || normalizedValue.length === 0 ? undefined : normalizedValue;
  }

  private static optionalString<Key extends string>(
    key: Key,
    value: string | undefined,
  ): Record<string, string> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { [key]: normalizedValue };
  }

  private static cloneMoney(money: ProductDraftMoney): ProductDraftMoney {
    return {
      amount: money.amount,
      currency: this.normalizeRequiredText(money.currency),
    };
  }

  private static toWeightGrams(weight: number, weightUnit: CreateProductDraftWeightUnit | undefined): number {
    switch (weightUnit) {
      case "kg":
        return weight * 1_000;
      case "lb":
        return weight * 453.59237;
      case "oz":
        return weight * 28.349523125;
      case "g":
      case undefined:
        return weight;
    }
  }

  private static isValidDateValue(value: string): boolean {
    return Number.isFinite(Date.parse(value));
  }

  private static addIssue(
    issues: ProductDraftValidationIssue[],
    code: string,
    field: string,
    message: string,
  ): void {
    issues.push({ code, field, message });
  }
}
