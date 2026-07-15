import { describe, expect, it } from "vitest";
import { SAIEAgentRegistry, DuplicateSAIEAgentRegistrationError } from "../agent-registry.js";
import { PRODUCT_AGENT_DEFINITION } from "./product-agent.js";
import { ProductAgent, parseProductAgentInput } from "./product-agent.js";
import type { ProductAgentInput, ProductAgentStepId } from "./product-agent.types.js";

const FIXED_DATE = new Date("2026-07-15T00:00:00.000Z");

describe("ProductAgent", () => {
  it("creates a minimal Product Agent plan", () => {
    const plan = new ProductAgent().plan(buildProductAgentInput(), FIXED_DATE);

    expect(plan).toMatchObject({
      agentType: "ProductAgent",
      executionMode: "plan-only",
      workflowId: "saie-product-agent-plan",
      readyForExecution: false,
      generatedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(stepIds(plan.orderedSteps)).toEqual([
      "ResolveProductSource",
      "NormalizeProduct",
      "RequireHumanApproval",
    ]);
  });

  it("creates a full-capability Product Agent plan", () => {
    const plan = new ProductAgent().plan(
      buildProductAgentInput({
        analyzeProduct: true,
        assessRisk: true,
        generateBranding: true,
        generateCopy: true,
        recommendPricing: true,
        mapForShopify: true,
        prepareSafeUpdate: true,
      }),
      FIXED_DATE,
    );

    expect(stepIds(plan.orderedSteps)).toEqual([
      "ResolveProductSource",
      "NormalizeProduct",
      "AnalyzeProduct",
      "AssessProductRisk",
      "GenerateProductBranding",
      "GenerateProductCopy",
      "RecommendProductPricing",
      "MapProductForShopify",
      "PrepareSafeShopifyUpdate",
      "RequireHumanApproval",
    ]);
  });

  it("excludes optional steps when capabilities are false", () => {
    const plan = new ProductAgent().plan(
      buildProductAgentInput({
        generateCopy: true,
        recommendPricing: true,
      }),
      FIXED_DATE,
    );

    expect(stepIds(plan.orderedSteps)).toEqual([
      "ResolveProductSource",
      "NormalizeProduct",
      "GenerateProductCopy",
      "RecommendProductPricing",
      "RequireHumanApproval",
    ]);
  });

  it("always makes human approval the final step", () => {
    const plan = new ProductAgent().plan(
      buildProductAgentInput({
        analyzeProduct: true,
        prepareSafeUpdate: true,
      }),
      FIXED_DATE,
    );

    expect(plan.orderedSteps.at(-1)?.id).toBe("RequireHumanApproval");
  });

  it("never includes a PublishProduct step", () => {
    const plan = new ProductAgent().plan(
      buildProductAgentInput({
        analyzeProduct: true,
        assessRisk: true,
        generateBranding: true,
        generateCopy: true,
        recommendPricing: true,
        mapForShopify: true,
        prepareSafeUpdate: true,
      }),
      FIXED_DATE,
    );

    expect(stepIds(plan.orderedSteps)).not.toContain("PublishProduct" as ProductAgentStepId);
  });

  it("maps required ports to requested capabilities", () => {
    const plan = new ProductAgent().plan(
      buildProductAgentInput({
        assessRisk: true,
        mapForShopify: true,
      }),
      FIXED_DATE,
    );

    expect(plan.requiredPorts).toEqual([
      "ProductSourcePort",
      "ProductNormalizationPort",
      "ProductRiskAssessmentPort",
      "ShopifyProductMappingPort",
      "HumanApprovalPort",
    ]);
  });

  it("rejects duplicate ProductAgent registration deterministically", () => {
    expect(() => {
      return new SAIEAgentRegistry([PRODUCT_AGENT_DEFINITION, PRODUCT_AGENT_DEFINITION]);
    }).toThrow(DuplicateSAIEAgentRegistrationError);
  });

  it("rejects unsupported execution mode", () => {
    expect(() => {
      parseProductAgentInput({
        ...buildProductAgentInput(),
        executionMode: "execute",
      });
    }).toThrow("Product Agent only supports plan-only execution mode.");
  });

  it("validates product reference values", () => {
    expect(() => {
      new ProductAgent().plan({
        ...buildProductAgentInput(),
        productReference: {
          kind: "shopify-product-id",
          value: "8351602737199",
        },
      });
    }).toThrow("Shopify product ID must be a Shopify Product GID.");
  });

  it("does not mutate input objects", () => {
    const input = buildProductAgentInput({
      generateCopy: true,
    });
    const originalMarket = [...input.brand.market];
    const originalCapabilities = { ...input.requestedCapabilities };

    new ProductAgent().plan(input, FIXED_DATE);

    expect(input.brand.market).toEqual(originalMarket);
    expect(input.requestedCapabilities).toEqual(originalCapabilities);
  });
});

const stepIds = (steps: readonly { readonly id: ProductAgentStepId }[]): readonly ProductAgentStepId[] =>
  steps.map((step) => step.id);

const buildProductAgentInput = (
  capabilities: Partial<ProductAgentInput["requestedCapabilities"]> = {},
): ProductAgentInput => ({
  productReference: {
    kind: "shopify-product-id",
    value: "gid://shopify/Product/8351602737199",
  },
  brand: {
    name: "Lumora Beauty",
    market: ["MY", "US"],
    currency: "MYR",
  },
  requestedCapabilities: {
    analyzeProduct: false,
    assessRisk: false,
    generateBranding: false,
    generateCopy: false,
    recommendPricing: false,
    mapForShopify: false,
    prepareSafeUpdate: false,
    ...capabilities,
  },
  executionMode: "plan-only",
});
