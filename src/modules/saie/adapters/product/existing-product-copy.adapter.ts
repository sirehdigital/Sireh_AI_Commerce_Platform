import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingProductCopyAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ProductCopyPort",
        adapterName: "ExistingProductCopyAdapter",
        existingServiceName: "ProductCopyService",
        existingServiceFile: "src/modules/ai-product/services/product-copy.service.ts",
        existingInputContract: "NormalizedProduct, ProductAIAnalysis, ProductBrandingResult",
        existingOutputContract: "ProductCopy",
        compatibility: "exact",
        externalCallRisk: "none",
        mutationRisk: "none",
        readinessStatus: "ready",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Maps to ProductCopyService.generate(product, analysis, branding).",
          "Existing service is deterministic and local; adapter does not invoke it in SAIE-01.03.",
        ],
      },
      dependency,
    );
  }
}
