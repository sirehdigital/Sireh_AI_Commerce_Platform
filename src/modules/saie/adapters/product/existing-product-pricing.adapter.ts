import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingProductPricingAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ProductPricingPort",
        adapterName: "ExistingProductPricingAdapter",
        existingServiceName: "ProductPricingService",
        existingServiceFile: "src/modules/ai-product/services/product-pricing.service.ts",
        existingInputContract: "NormalizedProduct, ProductAIAnalysis, ProductBrandingResult",
        existingOutputContract: "ProductPricingRecommendation",
        compatibility: "exact",
        externalCallRisk: "none",
        mutationRisk: "none",
        readinessStatus: "ready",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Maps to ProductPricingService.recommend(product, analysis, branding).",
          "Existing service is deterministic and local; adapter does not invoke it in SAIE-01.03.",
        ],
      },
      dependency,
    );
  }
}
