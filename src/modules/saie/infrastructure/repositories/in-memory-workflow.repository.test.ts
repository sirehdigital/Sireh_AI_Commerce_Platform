import { describe, expect, it } from "vitest";

import { DEFAULT_TENANT_CONTEXT, type TenantContext, type WorkflowRecord } from "../../application/index.js";
import { DuplicateWorkflowRecordError, InMemoryWorkflowRepository } from "./in-memory-workflow.repository.js";
import { createDeterministicWorkflowSeedRecords } from "./workflow-seed.provider.js";

const OTHER_TENANT: TenantContext = { tenantId: "tenant-other", storeId: "store-other" };

const buildWorkflow = (id: string, context: TenantContext = DEFAULT_TENANT_CONTEXT): WorkflowRecord => ({
  tenantId: context.tenantId,
  storeId: context.storeId,
  id,
  name: "Workflow",
  description: "Deterministic workflow record.",
  status: "draft",
  steps: [
    {
      id: "product-analysis",
      name: "Analyze product context",
      agentType: "ProductAgent",
      dependsOn: [],
    },
    {
      id: "copy-planning",
      name: "Plan product copy",
      agentType: "CopyAgent",
      dependsOn: ["product-analysis"],
    },
  ],
  source: "deterministic-preview",
  approvalRequired: true,
  executionEnabled: false,
});

describe("InMemoryWorkflowRepository", () => {
  it("initializes with deterministic seed records in stable order", () => {
    const repository = new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords());

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((workflow) => workflow.id)).toEqual([
      "shopify-product-orchestration",
    ]);
  });

  it("finds an existing workflow and returns undefined for an unknown ID", () => {
    const repository = new InMemoryWorkflowRepository([buildWorkflow("workflow-1")]);

    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "workflow-1")?.id).toBe("workflow-1");
    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "missing-workflow")).toBeUndefined();
    expect(repository.findById(OTHER_TENANT, "workflow-1")).toBeUndefined();
  });

  it("rejects duplicate workflow IDs during initialization", () => {
    expect(
      () => new InMemoryWorkflowRepository([buildWorkflow("workflow-1"), buildWorkflow("workflow-1")]),
    ).toThrow(DuplicateWorkflowRecordError);
  });

  it("returns safe copies so returned workflow mutation does not alter stored records", () => {
    const repository = new InMemoryWorkflowRepository([buildWorkflow("workflow-1")]);
    const workflow = repository.findById(DEFAULT_TENANT_CONTEXT, "workflow-1");

    expect(workflow).toBeDefined();
    if (workflow !== undefined) {
      workflow.steps[1]?.dependsOn.includes("product-analysis");
      const mutableSteps = workflow.steps as WorkflowRecord["steps"] & { push: (value: WorkflowRecord["steps"][number]) => number };
      mutableSteps.push({
        id: "unsafe-step",
        name: "Unsafe step",
        agentType: "CopyAgent",
        dependsOn: [],
      });
    }

    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "workflow-1")?.steps.map((step) => step.id)).toEqual([
      "product-analysis",
      "copy-planning",
    ]);
  });

  it("protects nested step dependency arrays from accidental mutation", () => {
    const repository = new InMemoryWorkflowRepository([buildWorkflow("workflow-1")]);
    const workflow = repository.findById(DEFAULT_TENANT_CONTEXT, "workflow-1");
    const copyStep = workflow?.steps.find((step) => step.id === "copy-planning");

    expect(copyStep).toBeDefined();
    if (copyStep !== undefined) {
      const mutableDependsOn = copyStep.dependsOn as readonly string[] & { push: (value: string) => number };
      mutableDependsOn.push("unsafe-dependency");
    }

    expect(
      repository.findById(DEFAULT_TENANT_CONTEXT, "workflow-1")?.steps.find((step) => step.id === "copy-planning")?.dependsOn,
    ).toEqual(["product-analysis"]);
  });

  it("does not expose mutable internal arrays through list results", () => {
    const repository = new InMemoryWorkflowRepository([
      buildWorkflow("workflow-1"),
      buildWorkflow("workflow-2"),
    ]);
    const workflows = repository.list(DEFAULT_TENANT_CONTEXT);
    const mutableWorkflows = workflows as readonly WorkflowRecord[] & {
      pop: () => WorkflowRecord | undefined;
    };

    mutableWorkflows.pop();

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((workflow) => workflow.id)).toEqual(["workflow-1", "workflow-2"]);
  });
});
