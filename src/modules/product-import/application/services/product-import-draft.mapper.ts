import type { AIProductEngineResult } from "../../../ai-product/services/ai-product-engine.service.js";
import type { CreateProductDraftDto, CreateProductDraftVariantDto } from "../../../product-draft/application/dto/create-product-draft.dto.js";
import type { SupplierProductImportInput } from "../../domain/models/product-import.model.js";

const optionalField = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> => (value === undefined ? {} : ({ [key]: value } as Record<Key, Value>));

export class ProductImportDraftMapper {
  public map(input: {
    readonly importId: string;
    readonly idempotencyKey: string;
    readonly requestedBy: string;
    readonly requestedAt: string;
    readonly correlationId?: string;
    readonly supplierInput: SupplierProductImportInput;
    readonly engine: AIProductEngineResult;
    readonly forced: boolean;
  }): CreateProductDraftDto {
    const product = input.engine.normalizedProduct;
    const sourceId = input.forced ? `${input.idempotencyKey}:force:${input.importId}` : input.idempotencyKey;

    return {
      sourceType: input.supplierInput.sourcePlatform === "autods" ? "autods" : "import",
      sourceReference: {
        sourceId,
        sourceName: input.supplierInput.sourcePlatform,
        importedAt: input.requestedAt,
      },
      supplier: {
        ...optionalField("supplierName", input.supplierInput.supplierName),
        supplierProductId: input.supplierInput.externalProductId,
        marketplace: input.supplierInput.sourcePlatform,
      },
      externalCorrelationId: input.importId,
      title: input.engine.shopifyPayload.title,
      description: input.engine.shopifyPayload.descriptionHtml,
      ...optionalField("vendor", input.engine.shopifyPayload.vendor),
      ...optionalField("productType", input.engine.shopifyPayload.productType),
      tags: input.engine.shopifyPayload.tags,
      targetMarkets: product.targetMarkets,
      images: input.engine.shopifyPayload.images.map((image, index) => ({
        url: image.src,
        ...optionalField("altText", image.altText),
        position: image.position ?? index + 1,
      })),
      variants: this.mapVariants(input.engine),
      shippingEstimate: {
        minimumDeliveryDays: product.supplier?.estimatedDeliveryDaysMin ?? 0,
        maximumDeliveryDays: product.supplier?.estimatedDeliveryDaysMax ?? product.supplier?.estimatedDeliveryDaysMin ?? 0,
        ...optionalField("shipsFromCountry", product.supplier?.shippingOrigin),
        shipsToCountries: input.supplierInput.shippingDestinations,
      },
      ...optionalField("seo", input.engine.shopifyPayload.seo),
      branding: {
        ...optionalField("brandName", product.brand),
        productName: input.engine.branding.brandedTitle,
        ...optionalField("collectionName", product.category),
        positioning: input.engine.branding.positioningStatement,
        targetAudience: [input.engine.branding.primaryAudience],
        valueProposition: input.engine.branding.uniqueSellingProposition,
      },
      riskAssessment: {
        level: input.engine.risk.level,
        score: input.engine.risk.score,
        reasons: input.engine.risk.reasons,
        restrictedClaims: input.engine.branding.avoidedClaims,
        assessedAt: input.requestedAt,
      },
      ai: {
        analyzed: true,
        branded: true,
        copyGenerated: true,
        pricingRecommended: true,
        riskAssessed: true,
        lastProcessedAt: input.requestedAt,
        modelReference: input.engine.analysis.model,
      },
      request: {
        requestedBy: input.requestedBy,
        requestedAt: input.requestedAt,
        ...optionalField("correlationId", input.correlationId),
        idempotencyKey: input.forced ? `${input.idempotencyKey}:force:${input.importId}` : input.idempotencyKey,
      },
    };
  }

  private mapVariants(engine: AIProductEngineResult): readonly CreateProductDraftVariantDto[] {
    return engine.normalizedProduct.variants.map((variant, index) => {
      const payloadVariant = engine.shopifyPayload.variants[index];
      const price = payloadVariant?.price ?? engine.pricing.recommendedSellingPrice;
      const compareAtPrice = payloadVariant?.compareAtPrice;
      const currency = engine.pricing.currency;

      return {
        ...optionalField("sourceVariantId", variant.supplierVariantId ?? variant.id),
        title: payloadVariant?.title ?? variant.title,
        ...optionalField("sku", payloadVariant?.sku ?? variant.sku ?? `IMPORT-${index + 1}`),
        price: { amount: price, currency },
        ...(compareAtPrice === undefined ? {} : { compareAtPrice: { amount: compareAtPrice, currency } }),
        cost: { amount: variant.cost ?? 0, currency },
        inventoryQuantity: payloadVariant?.inventoryQuantity ?? variant.inventoryQuantity ?? 0,
        optionValues: Object.entries(payloadVariant?.optionValues ?? variant.optionValues).map(([name, value]) => ({ name, value })),
        ...optionalField("weight", payloadVariant?.weight ?? variant.weight),
        ...optionalField("weightUnit", payloadVariant?.weightUnit ?? variant.weightUnit),
        taxable: true,
        requiresShipping: true,
      };
    });
  }
}
