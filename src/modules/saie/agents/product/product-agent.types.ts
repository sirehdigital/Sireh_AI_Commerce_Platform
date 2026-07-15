import type { SAIEAgentType } from "../../types/index.js";
import type { ProductAgentPortIdentifier } from "./product-agent.ports.js";

export type ProductReferenceKind = "shopify-product-id" | "shopify-handle" | "supplier-url";

export interface ProductAgentProductReference {
  readonly kind: ProductReferenceKind;
  readonly value: string;
}

export interface ProductAgentBrandInput {
  readonly name: string;
  readonly market: readonly string[];
  readonly currency: string;
}

export interface ProductAgentRequestedCapabilities {
  readonly analyzeProduct: boolean;
  readonly assessRisk: boolean;
  readonly generateBranding: boolean;
  readonly generateCopy: boolean;
  readonly recommendPricing: boolean;
  readonly mapForShopify: boolean;
  readonly prepareSafeUpdate: boolean;
}

export type ProductAgentExecutionMode = "plan-only";

export type ProductAgentInput = Readonly<{
  readonly productReference: ProductAgentProductReference;
  readonly brand: ProductAgentBrandInput;
  readonly requestedCapabilities: ProductAgentRequestedCapabilities;
  readonly executionMode: ProductAgentExecutionMode;
}> &
  Readonly<Record<string, unknown>>;

export type ProductAgentStepId =
  | "ResolveProductSource"
  | "NormalizeProduct"
  | "AnalyzeProduct"
  | "AssessProductRisk"
  | "GenerateProductBranding"
  | "GenerateProductCopy"
  | "RecommendProductPricing"
  | "MapProductForShopify"
  | "PrepareSafeShopifyUpdate"
  | "RequireHumanApproval";

export interface ProductAgentStep {
  readonly id: ProductAgentStepId;
  readonly order: number;
  readonly name: string;
  readonly requiredPort: ProductAgentPortIdentifier;
  readonly mutatesData: false;
}

export interface ProductAgentOutput extends Readonly<Record<string, unknown>> {
  readonly agentType: Extract<SAIEAgentType, "ProductAgent">;
  readonly executionMode: ProductAgentExecutionMode;
  readonly workflowId: "saie-product-agent-plan";
  readonly orderedSteps: readonly ProductAgentStep[];
  readonly requiredPorts: readonly ProductAgentPortIdentifier[];
  readonly requestedCapabilities: ProductAgentRequestedCapabilities;
  readonly safetyWarnings: readonly string[];
  readonly readyForExecution: false;
  readonly generatedAt: string;
}

export class ProductAgentInputValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProductAgentInputValidationError";
  }
}
