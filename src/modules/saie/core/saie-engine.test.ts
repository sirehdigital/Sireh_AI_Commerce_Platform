import { describe, expect, it } from "vitest";
import { SAIEEngine } from "./saie-engine.js";
import type { SAIEContext } from "../types/index.js";

const CONTEXT: SAIEContext = {
  correlationId: "saie-test-correlation",
  tenantId: "lumora-beauty",
  requestedBy: "unit-test",
  source: "system",
  metadata: {},
};

describe("SAIEEngine", () => {
  it("returns a deterministic Product Agent plan through the SAIE response contract", () => {
    const response = new SAIEEngine().plan({
      id: "request-1",
      context: CONTEXT,
      targetAgent: "ProductAgent",
      intent: "plan-product-workflow",
      payload: {
        productReference: {
          kind: "shopify-handle",
          value: "lumora-revive-red-light-scalp-massager",
        },
        brand: {
          name: "Lumora Beauty",
          market: ["MY"],
          currency: "MYR",
        },
        requestedCapabilities: {
          analyzeProduct: true,
          assessRisk: false,
          generateBranding: false,
          generateCopy: true,
          recommendPricing: false,
          mapForShopify: false,
          prepareSafeUpdate: false,
        },
        executionMode: "plan-only",
      },
    });

    expect(response.status).toBe("planned");
    expect(response.result.workflowId).toBe("saie-product-agent-plan");
    expect(response.warnings).toEqual([
      "SAIE Product Agent generated a plan only. No execution or mutation was performed.",
    ]);
  });

  it("fails safely for registered agents without planning implementations", () => {
    const response = new SAIEEngine().plan({
      id: "request-2",
      context: CONTEXT,
      targetAgent: "CEOAgent",
      intent: "plan-executive-workflow",
      payload: {},
    });

    expect(response.status).toBe("rejected");
    expect(response.result).toEqual({ workflowStatus: "not-executed" });
    expect(response.warnings).toEqual(["Agent CEOAgent does not have a planning implementation."]);
  });
});
