export const PRODUCT_AGENT_PORT_IDENTIFIERS = [
  "ProductSourcePort",
  "ProductNormalizationPort",
  "ProductAnalysisPort",
  "ProductRiskAssessmentPort",
  "ProductBrandingPort",
  "ProductCopyPort",
  "ProductPricingPort",
  "ShopifyProductMappingPort",
  "ShopifySafeUpdatePort",
  "HumanApprovalPort",
] as const;

export type ProductAgentPortIdentifier = (typeof PRODUCT_AGENT_PORT_IDENTIFIERS)[number];

export interface ProductAgentPortRequirement {
  readonly identifier: ProductAgentPortIdentifier;
  readonly purpose: string;
}

export interface ProductAgentPorts {
  readonly productSource?: unknown;
  readonly productNormalization?: unknown;
  readonly productAnalysis?: unknown;
  readonly productRiskAssessment?: unknown;
  readonly productBranding?: unknown;
  readonly productCopy?: unknown;
  readonly productPricing?: unknown;
  readonly shopifyProductMapping?: unknown;
  readonly shopifySafeUpdate?: unknown;
  readonly humanApproval?: unknown;
}
