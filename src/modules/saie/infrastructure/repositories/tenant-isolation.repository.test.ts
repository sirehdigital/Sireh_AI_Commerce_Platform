import { describe, expect, it } from "vitest";

import {
  DEFAULT_TENANT_CONTEXT,
  type ApprovalRecord,
  type AuditRecord,
  type ExecutionRecord,
  type TenantContext,
  type WorkflowRecord,
} from "../../application/index.js";
import { InMemoryApprovalRepository } from "./in-memory-approval.repository.js";
import { InMemoryAuditRepository } from "./in-memory-audit.repository.js";
import { InMemoryExecutionRepository } from "./in-memory-execution.repository.js";
import { InMemoryWorkflowRepository } from "./in-memory-workflow.repository.js";

const TENANT_B: TenantContext = { tenantId: "tenant-b", storeId: "store-b" };

describe("SAIE process-local repository tenant isolation", () => {
  it("workflow, approval, audit, and execution repositories enforce tenant scope internally", () => {
    const workflowRepository = new InMemoryWorkflowRepository([
      workflow("workflow-a", DEFAULT_TENANT_CONTEXT),
      workflow("workflow-b", TENANT_B),
    ]);
    const approvalRepository = new InMemoryApprovalRepository([
      approval("approval-a", DEFAULT_TENANT_CONTEXT),
      approval("approval-b", TENANT_B),
    ]);
    const auditRepository = new InMemoryAuditRepository([
      audit("audit-a", DEFAULT_TENANT_CONTEXT),
      audit("audit-b", TENANT_B),
    ]);
    const executionRepository = new InMemoryExecutionRepository([
      execution("execution-a", "approval-a", DEFAULT_TENANT_CONTEXT),
      execution("execution-b", "approval-b", TENANT_B),
    ]);

    expect(workflowRepository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual(["workflow-a"]);
    expect(approvalRepository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual(["approval-a"]);
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual(["audit-a"]);
    expect(executionRepository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual(["execution-a"]);

    expect(workflowRepository.findById(DEFAULT_TENANT_CONTEXT, "workflow-b")).toBeUndefined();
    expect(approvalRepository.findById(DEFAULT_TENANT_CONTEXT, "approval-b")).toBeUndefined();
    expect(auditRepository.findById(DEFAULT_TENANT_CONTEXT, "audit-b")).toBeUndefined();
    expect(executionRepository.findById(DEFAULT_TENANT_CONTEXT, "execution-b")).toBeUndefined();
  });
});

const scoped = (context: TenantContext): Pick<WorkflowRecord, "tenantId" | "storeId" | "shopDomain"> => ({
  tenantId: context.tenantId,
  storeId: context.storeId,
  ...(context.shopDomain === undefined ? {} : { shopDomain: context.shopDomain }),
});

const workflow = (id: string, context: TenantContext): WorkflowRecord => ({
  ...scoped(context),
  id,
  name: id,
  description: "Tenant-scoped workflow.",
  status: "draft",
  steps: [],
  source: "deterministic-preview",
  approvalRequired: true,
  executionEnabled: false,
});

const approval = (id: string, context: TenantContext): ApprovalRecord => ({
  ...scoped(context),
  id,
  proposalId: `proposal-${id}`,
  workflowId: "workflow-a",
  title: id,
  status: "pending",
  riskLevel: "LOW",
  requestedBy: "Product Agent",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  requiresHumanApproval: true,
  executionEnabled: false,
  source: "deterministic-preview",
  version: 1,
});

const audit = (id: string, context: TenantContext): AuditRecord => ({
  ...scoped(context),
  id,
  eventType: "approval.approved",
  entityType: "approval",
  entityId: "approval-a",
  actor: "human-reviewer",
  occurredAt: "2026-07-16T00:00:00.000Z",
  summary: "Approved.",
  details: {},
  source: "in-memory-live",
  sequence: 1,
});

const execution = (id: string, approvalId: string, context: TenantContext): ExecutionRecord => ({
  ...scoped(context),
  id,
  workflowId: "workflow-a",
  approvalId,
  title: id,
  status: "prepared",
  mode: "preview",
  executionEnabled: false,
  approvalRequired: true,
  executableActions: [],
  source: "in-memory-prepared",
});

