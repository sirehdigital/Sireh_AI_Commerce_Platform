import { describe, expect, it } from "vitest";
import { ProductAgent } from "../../agents/product/index.js";
import { SAIEEngine } from "../../core/index.js";
import { ExistingProductNormalizationAdapter } from "./existing-product-normalization.adapter.js";
import { ProductAdapterReadinessService } from "./product-adapter-readiness.service.js";
import type { ProductReadinessAdapter } from "./product-adapter.types.js";
import {
  DuplicateProductAdapterPortError,
  UnsupportedProductAdapterReadinessModeError,
} from "./product-adapter.types.js";

const FIXED_DATE = new Date("2026-07-15T00:00:00.000Z");

describe("ProductAdapterReadinessService", () => {
  it("creates a deterministic readiness report", () => {
    const report = new ProductAdapterReadinessService().createReport(FIXED_DATE);

    expect(report).toMatchObject({
      agentType: "ProductAgent",
      mode: "readiness-only",
      safeForExecution: false,
      generatedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(report.adapters.map((adapter) => adapter.port)).toEqual([
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
    ]);
  });

  it("keeps all mapped ports unique", () => {
    const report = new ProductAdapterReadinessService().createReport(FIXED_DATE);
    const uniquePorts = new Set(report.adapters.map((adapter) => adapter.port));

    expect(uniquePorts.size).toBe(report.adapters.length);
  });

  it("rejects duplicate port mappings", () => {
    expect(() => {
      return new ProductAdapterReadinessService([
        new ExistingProductNormalizationAdapter(),
        new ExistingProductNormalizationAdapter(),
      ]);
    }).toThrow(DuplicateProductAdapterPortError);
  });

  it("reports missing ports as unavailable", () => {
    const report = new ProductAdapterReadinessService([
      new ExistingProductNormalizationAdapter(),
    ]).createReport(FIXED_DATE);

    expect(report.readyPorts).toEqual(["ProductNormalizationPort"]);
    expect(report.unavailablePorts).toEqual([
      "ProductSourcePort",
      "ProductAnalysisPort",
      "ProductRiskAssessmentPort",
      "ProductBrandingPort",
      "ProductCopyPort",
      "ProductPricingPort",
      "ShopifyProductMappingPort",
      "ShopifySafeUpdatePort",
      "HumanApprovalPort",
    ]);
  });

  it("always reports safeForExecution as false", () => {
    expect(new ProductAdapterReadinessService().createReport(FIXED_DATE).safeForExecution).toBe(false);
  });

  it("keeps ShopifySafeUpdatePort blocked from execution", () => {
    const report = new ProductAdapterReadinessService().createReport(FIXED_DATE);
    const safeUpdate = report.adapters.find((adapter) => adapter.port === "ShopifySafeUpdatePort");

    expect(safeUpdate).toMatchObject({
      readinessStatus: "blocked",
      externalCallRisk: "external-call-and-mutation",
      mutationRisk: "external-call-and-mutation",
    });
    expect(safeUpdate?.notes.join(" ")).toContain("post-mutation read-back audit");
  });

  it("does not invoke an underlying dependency", () => {
    const dependency = {
      normalize(): never {
        throw new Error("Dependency should not be invoked.");
      },
    };
    const report = new ProductAdapterReadinessService([
      new ExistingProductNormalizationAdapter(dependency),
    ]).createReport(FIXED_DATE);

    expect(report.readyPorts).toEqual(["ProductNormalizationPort"]);
  });

  it("keeps existing Product Agent planning unchanged", () => {
    const plan = new ProductAgent().plan(
      {
        productReference: {
          kind: "shopify-product-id",
          value: "gid://shopify/Product/8351602737199",
        },
        brand: {
          name: "Lumora Beauty",
          market: ["MY"],
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
        },
        executionMode: "plan-only",
      },
      FIXED_DATE,
    );

    expect(plan.orderedSteps.map((step) => step.id)).toEqual([
      "ResolveProductSource",
      "NormalizeProduct",
      "RequireHumanApproval",
    ]);
  });

  it("rejects unsupported readiness modes", () => {
    expect(() => {
      new ProductAdapterReadinessService().createReport(
        FIXED_DATE,
        "execution" as Parameters<ProductAdapterReadinessService["createReport"]>[1],
      );
    }).toThrow(UnsupportedProductAdapterReadinessModeError);
  });

  it("does not mutate input adapter metadata", () => {
    const adapter = new MutableMetadataAdapter();
    const service = new ProductAdapterReadinessService([adapter]);
    const before = adapter.getReadinessItem().notes;

    const report = service.createReport(FIXED_DATE);

    expect(
      report.adapters.find(
        (readinessItem) => readinessItem.adapterName === "MutableMetadataAdapter",
      )?.notes,
    ).toEqual(before);
    expect(adapter.getReadinessItem().notes).toEqual(before);
  });

  it("exposes adapter readiness separately from SAIEEngine.plan", () => {
    const engine = new SAIEEngine();
    const report = engine.getProductAdapterReadinessReport(FIXED_DATE);

    expect(report.mode).toBe("readiness-only");
    expect(report.safeForExecution).toBe(false);
  });
});

class MutableMetadataAdapter implements ProductReadinessAdapter {
  public readonly mode = "readiness-only";
  private readonly notes: string[] = ["Original note"];

  public getReadinessItem() {
    return {
      port: "ProductNormalizationPort",
      adapterName: "MutableMetadataAdapter",
      existingServiceName: "ProductNormalizerService",
      existingServiceFile: "src/modules/ai-product/services/product-normalizer.service.ts",
      existingInputContract: "RawProductInput",
      existingOutputContract: "NormalizedProduct",
      compatibility: "exact",
      externalCallRisk: "none",
      mutationRisk: "none",
      readinessStatus: "ready",
      canBeCreatedWithoutBusinessLogicChanges: true,
      notes: [...this.notes],
    } as const;
  }

  public validateDependency() {
    return {
      dependencySupplied: false,
      notes: ["Not supplied"],
    };
  }
}
