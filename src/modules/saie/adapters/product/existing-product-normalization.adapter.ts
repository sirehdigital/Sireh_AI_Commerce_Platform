import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingProductNormalizationAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ProductNormalizationPort",
        adapterName: "ExistingProductNormalizationAdapter",
        existingServiceName: "ProductNormalizerService",
        existingServiceFile: "src/modules/ai-product/services/product-normalizer.service.ts",
        existingInputContract: "RawProductInput",
        existingOutputContract: "NormalizedProduct",
        compatibility: "exact",
        externalCallRisk: "none",
        mutationRisk: "none",
        readinessStatus: "ready",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Maps to ProductNormalizerService.normalize(input).",
          "Existing service is deterministic and local; adapter does not invoke it in SAIE-01.03.",
        ],
      },
      dependency,
    );
  }
}
