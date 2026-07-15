import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingProductRiskAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ProductRiskAssessmentPort",
        adapterName: "ExistingProductRiskAdapter",
        existingServiceName: "ProductRiskAssessmentService",
        existingServiceFile: "src/modules/ai-product/services/product-risk-assessment.service.ts",
        existingInputContract: "NormalizedProduct",
        existingOutputContract: "ProductRiskAssessment",
        compatibility: "exact",
        externalCallRisk: "none",
        mutationRisk: "none",
        readinessStatus: "ready",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Maps to ProductRiskAssessmentService.assess(product).",
          "Existing service is deterministic and local; adapter does not invoke it in SAIE-01.03.",
        ],
      },
      dependency,
    );
  }
}
