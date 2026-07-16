export const SAIE_AGENT_TYPES = [
  "ProductAgent",
  "ContentAgent",
  "BrandingAgent",
  "CopyAgent",
  "SEOAgent",
  "PricingAgent",
  "MarketingAgent",
  "AnalyticsAgent",
  "CEOAgent",
] as const;

export type SAIEAgentType = (typeof SAIE_AGENT_TYPES)[number];

export type SAIEAgentCapability =
  | "product-analysis"
  | "product-risk-assessment"
  | "content-planning"
  | "brand-positioning"
  | "copy-planning"
  | "seo-planning"
  | "pricing-planning"
  | "shopify-mapping"
  | "safe-update-planning"
  | "marketing-planning"
  | "analytics-planning"
  | "executive-orchestration";

export interface SAIEAgentDefinition {
  readonly type: SAIEAgentType;
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly SAIEAgentCapability[];
  readonly implementationStatus: "registry-only" | "planner-only";
}

export interface SAIEAgent {
  readonly definition: SAIEAgentDefinition;
}
