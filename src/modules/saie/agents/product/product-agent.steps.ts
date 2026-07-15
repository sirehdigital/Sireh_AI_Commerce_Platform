import type { ProductAgentRequestedCapabilities, ProductAgentStep } from "./product-agent.types.js";

interface ProductAgentStepTemplate {
  readonly id: ProductAgentStep["id"];
  readonly name: string;
  readonly requiredPort: ProductAgentStep["requiredPort"];
  readonly isIncluded: (capabilities: ProductAgentRequestedCapabilities) => boolean;
}

const PRODUCT_AGENT_STEP_TEMPLATES: readonly ProductAgentStepTemplate[] = [
  {
    id: "ResolveProductSource",
    name: "Resolve product source",
    requiredPort: "ProductSourcePort",
    isIncluded: () => true,
  },
  {
    id: "NormalizeProduct",
    name: "Normalize product data",
    requiredPort: "ProductNormalizationPort",
    isIncluded: () => true,
  },
  {
    id: "AnalyzeProduct",
    name: "Analyze product",
    requiredPort: "ProductAnalysisPort",
    isIncluded: (capabilities) => capabilities.analyzeProduct,
  },
  {
    id: "AssessProductRisk",
    name: "Assess product risk",
    requiredPort: "ProductRiskAssessmentPort",
    isIncluded: (capabilities) => capabilities.assessRisk,
  },
  {
    id: "GenerateProductBranding",
    name: "Generate product branding plan",
    requiredPort: "ProductBrandingPort",
    isIncluded: (capabilities) => capabilities.generateBranding,
  },
  {
    id: "GenerateProductCopy",
    name: "Generate product copy plan",
    requiredPort: "ProductCopyPort",
    isIncluded: (capabilities) => capabilities.generateCopy,
  },
  {
    id: "RecommendProductPricing",
    name: "Recommend product pricing plan",
    requiredPort: "ProductPricingPort",
    isIncluded: (capabilities) => capabilities.recommendPricing,
  },
  {
    id: "MapProductForShopify",
    name: "Map product for Shopify",
    requiredPort: "ShopifyProductMappingPort",
    isIncluded: (capabilities) => capabilities.mapForShopify,
  },
  {
    id: "PrepareSafeShopifyUpdate",
    name: "Prepare safe Shopify update",
    requiredPort: "ShopifySafeUpdatePort",
    isIncluded: (capabilities) => capabilities.prepareSafeUpdate,
  },
  {
    id: "RequireHumanApproval",
    name: "Require human approval",
    requiredPort: "HumanApprovalPort",
    isIncluded: () => true,
  },
];

export const createProductAgentSteps = (
  capabilities: ProductAgentRequestedCapabilities,
): readonly ProductAgentStep[] =>
  PRODUCT_AGENT_STEP_TEMPLATES.filter((template) => template.isIncluded(capabilities)).map(
    (template, index) => ({
      id: template.id,
      order: index + 1,
      name: template.name,
      requiredPort: template.requiredPort,
      mutatesData: false,
    }),
  );
