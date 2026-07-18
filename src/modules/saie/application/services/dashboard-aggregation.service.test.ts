import { describe, expect, it } from "vitest";

import { renderDashboardPreviewHtml } from "../../presentation/index.js";
import {
  InMemoryApprovalRepository,
  InMemoryAuditRepository,
  InMemoryExecutionRepository,
  InMemoryWorkflowRepository,
  createDeterministicApprovalSeedRecords,
  createDeterministicAuditSeedRecords,
  createDeterministicExecutionSeedRecords,
  createDeterministicWorkflowSeedRecords,
} from "../../infrastructure/index.js";
import type {
  ApprovalRecord,
  AuditRepository,
  ExecutionRepository,
  WorkflowRepository,
} from "../repositories/index.js";
import { DashboardAggregationService } from "./dashboard-aggregation.service.js";
import { ApprovalService } from "./approval.service.js";
import { AuditRecorderService } from "./audit-recorder.service.js";
import { ExecutionPreparationService } from "./execution-preparation.service.js";
import { DEFAULT_TENANT_CONTEXT } from "../tenant/index.js";

const createRepositories = () => {
  const workflowRepository = new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords());
  const approvalRepository = new InMemoryApprovalRepository(createDeterministicApprovalSeedRecords());
  const auditRepository = new InMemoryAuditRepository(createDeterministicAuditSeedRecords());
  const executionRepository = new InMemoryExecutionRepository(
    createDeterministicExecutionSeedRecords(workflowRepository),
  );

  return { approvalRepository, auditRepository, executionRepository, workflowRepository };
};

const approvedApproval: ApprovalRecord = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "approval-product-context",
  proposalId: "proposal-product-context",
  workflowId: "shopify-product-orchestration",
  title: "Product <Context>",
  status: "approved",
  riskLevel: "LOW",
  requestedBy: "<script>alert('x')</script> & Reviewer",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  decidedAt: "2026-07-16T00:00:00.000Z",
  decidedBy: "\"reviewer\" <script>",
  requiresHumanApproval: true,
  executionEnabled: false,
  source: "human-decision",
  version: 2,
};

describe("DashboardAggregationService", () => {
  it("calculates live KPIs from repository state", () => {
    const repositories = createRepositories();
    const approvalService = new ApprovalService(
      repositories.approvalRepository,
      () => new Date("2026-07-16T00:00:00.000Z"),
    );
    const auditRecorder = new AuditRecorderService(
      repositories.auditRepository,
      () => "audit-live-approved",
      () => "2026-07-16T00:00:00.000Z",
    );
    const approval = approvalService.approve({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      decidedBy: "human-reviewer",
      expectedVersion: 1,
    });
    auditRecorder.recordApprovalDecision({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: approval.id,
      proposalId: approval.proposalId,
      decision: "approved",
      actor: approval.decidedBy ?? "human-reviewer",
      approvalVersion: approval.version,
      ...(approval.workflowId === undefined ? {} : { workflowId: approval.workflowId }),
    });

    const snapshot = new DashboardAggregationService(
      repositories.workflowRepository,
      repositories.approvalRepository,
      repositories.auditRepository,
      repositories.executionRepository,
      undefined,
      () => "2026-07-16T00:00:00.000Z",
    ).getDashboardSnapshot(DEFAULT_TENANT_CONTEXT);

    expect(snapshot.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Pending approvals", value: "3" }),
        expect.objectContaining({ label: "Approved approvals", value: "1" }),
        expect.objectContaining({ label: "Live audit events", value: "1" }),
        expect.objectContaining({ label: "Prepared executions", value: "0" }),
        expect.objectContaining({ label: "Execution mode", value: "Disabled" }),
      ]),
    );
    expect(snapshot.proposalQueue[3]).toMatchObject({
      proposalType: "Product Context",
      readiness: "Approved for internal preparation",
    });
    expect(snapshot.agentActivity[0]?.activityType).toContain("approval.approved");
  });

  it("reflects prepared executions without reporting completion or publication", () => {
    const workflowRepository = new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords());
    const approvalRepository = new InMemoryApprovalRepository([approvedApproval]);
    const auditRepository = new InMemoryAuditRepository(createDeterministicAuditSeedRecords());
    const executionRepository = new InMemoryExecutionRepository(
      createDeterministicExecutionSeedRecords(workflowRepository),
    );
    new ExecutionPreparationService(
      approvalRepository,
      executionRepository,
      workflowRepository,
      new AuditRecorderService(
        auditRepository,
        () => "audit-execution-prepared",
        () => "2026-07-16T00:00:00.000Z",
      ),
      () => "execution-live-product-context",
      () => "2026-07-16T00:00:00.000Z",
    ).prepareExecution({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      preparedBy: "internal-review-coordinator",
    });

    const snapshot = new DashboardAggregationService(
      workflowRepository,
      approvalRepository,
      auditRepository,
      executionRepository,
      undefined,
      () => "2026-07-16T00:00:00.000Z",
    ).getDashboardSnapshot(DEFAULT_TENANT_CONTEXT);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.operationsSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Prepared executions", value: "1" }),
      ]),
    );
    expect(snapshot.agentActivity[0]?.activityType).toContain("execution.prepared");
    expect(serialized).not.toMatch(/execution\.completed|product\.published|status":"running"|status":"completed"/iu);
  });

  it("reads each repository list once per snapshot", () => {
    const repositories = createRepositories();
    let workflowReads = 0;
    let approvalReads = 0;
    let auditReads = 0;
    let executionReads = 0;
    const workflowRepository: WorkflowRepository = {
      list: (tenant) => {
        workflowReads += 1;
        return repositories.workflowRepository.list(tenant);
      },
      findById: (tenant, workflowId) => repositories.workflowRepository.findById(tenant, workflowId),
    };
    const approvalRepository = {
      list: (tenant: typeof DEFAULT_TENANT_CONTEXT) => {
        approvalReads += 1;
        return repositories.approvalRepository.list(tenant);
      },
      findById: (tenant: typeof DEFAULT_TENANT_CONTEXT, approvalId: string) => repositories.approvalRepository.findById(tenant, approvalId),
      save: (tenant: typeof DEFAULT_TENANT_CONTEXT, approval: ApprovalRecord, expectedVersion?: number) =>
        repositories.approvalRepository.save(tenant, approval, expectedVersion),
    };
    const auditRepository: AuditRepository = {
      list: (tenant) => {
        auditReads += 1;
        return repositories.auditRepository.list(tenant);
      },
      findById: (tenant, auditId) => repositories.auditRepository.findById(tenant, auditId),
      append: (tenant, record) => repositories.auditRepository.append(tenant, record),
    };
    const executionRepository: ExecutionRepository = {
      list: (tenant) => {
        executionReads += 1;
        return repositories.executionRepository.list(tenant);
      },
      findById: (tenant, executionId) => repositories.executionRepository.findById(tenant, executionId),
      findByApprovalId: (tenant, approvalId) => repositories.executionRepository.findByApprovalId(tenant, approvalId),
      append: (tenant, record) => repositories.executionRepository.append(tenant, record),
    };

    new DashboardAggregationService(
      workflowRepository,
      approvalRepository,
      auditRepository,
      executionRepository,
    ).getDashboardSnapshot(DEFAULT_TENANT_CONTEXT);

    expect({ workflowReads, approvalReads, auditReads, executionReads }).toEqual({
      workflowReads: 1,
      approvalReads: 1,
      auditReads: 1,
      executionReads: 1,
    });
  });

  it("escapes repository-derived strings in rendered HTML", () => {
    const workflowRepository = new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords());
    const approvalRepository = new InMemoryApprovalRepository([approvedApproval]);
    const auditRepository = new InMemoryAuditRepository([
      {
        tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
        storeId: DEFAULT_TENANT_CONTEXT.storeId,
        id: "audit-script",
        eventType: "approval.approved",
        entityType: "approval",
        entityId: "approval-product-context",
        actor: "<script>alert('actor')</script>",
        occurredAt: "2026-07-16T00:00:00.000Z",
        summary: "Approved <danger> & \"quoted\"",
        details: {},
        source: "in-memory-live",
        sequence: 1,
      },
    ]);
    const executionRepository = new InMemoryExecutionRepository(
      createDeterministicExecutionSeedRecords(workflowRepository),
    );

    const html = renderDashboardPreviewHtml(
      new DashboardAggregationService(
        workflowRepository,
        approvalRepository,
        auditRepository,
        executionRepository,
      ).getDashboardSnapshot(DEFAULT_TENANT_CONTEXT),
    );

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert");
    expect(html).toContain("Product &lt;Context&gt;");
    expect(html).toContain("Approved &lt;danger&gt; &amp; &quot;quoted&quot;");
  });
});
