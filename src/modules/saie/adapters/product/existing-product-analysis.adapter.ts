import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingProductAnalysisAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ProductAnalysisPort",
        adapterName: "ExistingProductAnalysisAdapter",
        existingServiceName: "ProductAnalyzerService",
        existingServiceFile: "src/modules/ai-product/services/product-analyzer.service.ts",
        existingInputContract: "NormalizedProduct, ProductScoreBreakdown, ProductRiskAssessment",
        existingOutputContract: "ProductAIAnalysis",
        compatibility: "partial",
        externalCallRisk: "none",
        mutationRisk: "none",
        readinessStatus: "partial",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Maps to ProductAnalyzerService.analyze(product, score, risk).",
          "Partial because score and risk must already exist in the future orchestration state.",
          "Existing service is deterministic and local; adapter does not invoke it in SAIE-01.03.",
        ],
      },
      dependency,
    );
  }
}
