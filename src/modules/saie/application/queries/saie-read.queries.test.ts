import { describe, expect, it } from "vitest";

import { ApplicationNotFoundError } from "../errors/index.js";
import type {
  ApprovalReadModel,
  AuditReadModel,
  ExecutionReadModel,
  HealthReadModel,
  WorkflowReadModel,
} from "../models/index.js";
import { DashboardPreviewService } from "../../presentation/index.js";
import type {
  DashboardReadPort,
  HealthReadPort,
} from "../ports/index.js";
import type {
  ApprovalRepository,
  AuditRepository,
  ExecutionRepository,
  WorkflowRepository,
} from "../repositories/index.js";
import {
  GetApprovalByIdApplicationQuery,
  GetAuditByIdApplicationQuery,
  GetDashboardApplicationQuery,
  GetExecutionByIdApplicationQuery,
  GetHealthApplicationQuery,
  GetWorkflowByIdApplicationQuery,
  ListApprovalsApplicationQuery,
  ListAuditsApplicationQuery,
  ListExecutionsApplicationQuery,
  ListWorkflowsApplicationQuery,
} from "./index.js";
import { DEFAULT_TENANT_CONTEXT } from "../tenant/index.js";

const workflow: WorkflowReadModel = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "shopify-product-orchestration",
  name: "Shopify Product Orchestration",
  description: "Deterministic workflow preview.",
  status: "draft",
  steps: [],
  source: "deterministic-preview",
  approvalRequired: true,
  executionEnabled: false,
};

const approval: ApprovalReadModel = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "approval-product-context",
  proposalId: "proposal-product-context",
  workflowId: "shopify-product-orchestration",
  title: "Product Context",
  status: "pending",
  riskLevel: "LOW",
  requestedBy: "Product Agent",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  requiresHumanApproval: true,
  executionEnabled: false,
  source: "deterministic-preview",
  version: 1,
};

const audit: AuditReadModel = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "audit-product-agent-01",
  eventType: "preview.agent-activity",
  entityType: "agent-activity",
  entityId: "audit-product-agent-01",
  actor: "Product Agent",
  occurredAt: "Preview activity 01",
  summary: "Prepared product context",
  details: {
    agent: "Product Agent",
    activityType: "Prepared product context",
    status: "READY_FOR_REVIEW",
  },
  source: "deterministic-preview",
  sequence: 1,
  activityType: "Prepared product context",
  status: "READY_FOR_REVIEW",
  recordedAt: "Preview activity 01",
  evidence: "Deterministic preview activity only; not persisted audit evidence.",
};

const execution: ExecutionReadModel = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "execution-preview-shopify-product-orchestration",
  workflowId: "shopify-product-orchestration",
  title: "Shopify Product Orchestration execution preview",
  status: "DISABLED",
  mode: "preview",
  executionEnabled: false,
  approvalRequired: true,
  executableActions: [],
  source: "deterministic-preview",
};

describe("SAIE application read queries", () => {
  it("dashboard query delegates to the dashboard read port", () => {
    let calls = 0;
    const dashboardReadModel = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" });
    const port: DashboardReadPort = {
      getDashboard: (tenant) => {
        calls += 1;
        expect(tenant).toEqual(DEFAULT_TENANT_CONTEXT);
        return dashboardReadModel;
      },
    };

    expect(new GetDashboardApplicationQuery(port).execute({ tenant: DEFAULT_TENANT_CONTEXT })).toBe(dashboardReadModel);
    expect(calls).toBe(1);
  });

  it("health query returns safe values from the health read port", () => {
    const health: HealthReadModel = {
      status: "healthy",
      version: "0.2.0-beta",
      environment: "test",
      orchestrator: "available",
      executionEnabled: false,
      approvalRequired: true,
      timestamp: "2026-07-16T00:00:00.000Z",
      tenancy: {
        tenantContextSupported: true,
        tenantIsolationMode: "process-local",
        authenticatedTenantResolution: false,
        defaultContextEnabled: true,
      },
    };
    const port: HealthReadPort = {
      getHealth: () => health,
    };

    expect(new GetHealthApplicationQuery(port).execute()).toEqual(health);
    expect(JSON.stringify(health)).not.toMatch(/SECRET|TOKEN|DATABASE_URL|OPENAI/iu);
  });

  it("workflow queries list deterministic records and throw typed not-found errors", () => {
    const repository: WorkflowRepository = {
      list: (tenant) => (tenant.tenantId === workflow.tenantId ? [workflow] : []),
      findById: (tenant, workflowId) => (tenant.tenantId === workflow.tenantId && workflowId === workflow.id ? workflow : undefined),
    };

    expect(new ListWorkflowsApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT })).toEqual([workflow]);
    expect(new GetWorkflowByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: workflow.id })).toEqual(workflow);
    expect(() => new GetWorkflowByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: "missing-workflow" })).toThrow(
      ApplicationNotFoundError,
    );
  });

  it("approval queries keep human approval mandatory", () => {
    const repository: ApprovalRepository = {
      list: (tenant) => (tenant.tenantId === approval.tenantId ? [approval] : []),
      findById: (tenant, approvalId) => (tenant.tenantId === approval.tenantId && approvalId === approval.id ? approval : undefined),
      save: (_tenant, nextApproval) => nextApproval,
    };

    expect(new ListApprovalsApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT })[0]?.requiresHumanApproval).toBe(true);
    expect(new GetApprovalByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: approval.id })).toEqual(approval);
    expect(() => new GetApprovalByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: "missing-approval" })).toThrow(
      ApplicationNotFoundError,
    );
  });

  it("audit queries preserve deterministic preview source markers", () => {
    const repository: AuditRepository = {
      list: (tenant) => (tenant.tenantId === audit.tenantId ? [audit] : []),
      findById: (tenant, auditId) => (tenant.tenantId === audit.tenantId && auditId === audit.id ? audit : undefined),
      append: (_tenant, record) => record,
    };

    expect(new ListAuditsApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT })[0]?.source).toBe("deterministic-preview");
    expect(new GetAuditByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: audit.id })).toEqual(audit);
    expect(() => new GetAuditByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: "missing-audit" })).toThrow(
      ApplicationNotFoundError,
    );
  });

  it("execution queries remain preview-only and disabled", () => {
    const repository: ExecutionRepository = {
      list: (tenant) => (tenant.tenantId === execution.tenantId ? [execution] : []),
      findById: (tenant, executionId) => (tenant.tenantId === execution.tenantId && executionId === execution.id ? execution : undefined),
      findByApprovalId: () => undefined,
      append: (_tenant, record) => record,
    };

    expect(new ListExecutionsApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT })[0]).toMatchObject({
      mode: "preview",
      executionEnabled: false,
      approvalRequired: true,
      executableActions: [],
    });
    expect(new GetExecutionByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: execution.id })).toEqual(execution);
    expect(() => new GetExecutionByIdApplicationQuery(repository).execute({ tenant: DEFAULT_TENANT_CONTEXT, id: "missing-execution" })).toThrow(
      ApplicationNotFoundError,
    );
  });
});
