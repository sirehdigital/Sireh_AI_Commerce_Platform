import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingShopifyProductMappingAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ShopifyProductMappingPort",
        adapterName: "ExistingShopifyProductMappingAdapter",
        existingServiceName: "ShopifyProductMapperService",
        existingServiceFile: "src/modules/ai-product/services/shopify-product-mapper.service.ts",
        existingInputContract:
          "NormalizedProduct, ProductAIAnalysis, ProductBrandingResult, ProductCopy, ProductPricingRecommendation",
        existingOutputContract: "ShopifyProductPayload",
        compatibility: "exact",
        externalCallRisk: "none",
        mutationRisk: "none",
        readinessStatus: "ready",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Maps to ShopifyProductMapperService.map(product, analysis, branding, copy, pricing).",
          "Existing mapper builds an internal payload only; adapter does not invoke it in SAIE-01.03.",
        ],
      },
      dependency,
    );
  }
}
