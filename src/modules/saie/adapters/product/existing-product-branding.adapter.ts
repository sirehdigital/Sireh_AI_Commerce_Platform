import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingProductBrandingAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ProductBrandingPort",
        adapterName: "ExistingProductBrandingAdapter",
        existingServiceName: "ProductBrandingService",
        existingServiceFile: "src/modules/ai-product/services/product-branding.service.ts",
        existingInputContract: "NormalizedProduct, ProductAIAnalysis",
        existingOutputContract: "ProductBrandingResult",
        compatibility: "exact",
        externalCallRisk: "none",
        mutationRisk: "none",
        readinessStatus: "ready",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Maps to ProductBrandingService.buildBranding(product, analysis).",
          "Existing service is deterministic and local; adapter does not invoke it in SAIE-01.03.",
        ],
      },
      dependency,
    );
  }
}
