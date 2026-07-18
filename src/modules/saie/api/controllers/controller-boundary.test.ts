import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import type { WorkflowReadModel } from "../../application/index.js";
import { ApplicationNotFoundError, DEFAULT_TENANT_CONTEXT } from "../../application/index.js";
import { createTenantContextMiddleware } from "../middleware/index.js";
import { createWorkflowController } from "./workflow.controller.js";

const workflow: WorkflowReadModel = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "mock-workflow",
  name: "Mock Workflow",
  description: "Controller boundary test workflow.",
  status: "draft",
  steps: [],
  source: "deterministic-preview",
  approvalRequired: true,
  executionEnabled: false,
};

const createControllerTestApp = (): express.Express => {
  const app = express();
  const controller = createWorkflowController({
    listWorkflows: {
      execute: ({ tenant }) => (tenant.tenantId === DEFAULT_TENANT_CONTEXT.tenantId ? [workflow] : []),
    },
    getWorkflowById: {
      execute: ({ tenant, id }) => {
        if (tenant.tenantId === DEFAULT_TENANT_CONTEXT.tenantId && id === workflow.id) {
          return workflow;
        }

        throw new ApplicationNotFoundError("Workflow", id);
      },
    },
  });

  app.use(createTenantContextMiddleware());
  app.get("/workflows", controller.listWorkflows);
  app.get("/workflows/:workflowId", controller.getWorkflow);

  return app;
};

describe("SAIE controller application boundary", () => {
  it("uses mocked application queries without constructing domain services", async () => {
    const response = await request(createControllerTestApp()).get("/workflows").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: [
        {
          id: "mock-workflow",
          source: "deterministic-preview",
        },
      ],
    });
  });

  it("translates application not-found errors into the API error contract", async () => {
    const response = await request(createControllerTestApp()).get("/workflows/missing-workflow").expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Workflow was not found.",
      },
    });
  });
});
