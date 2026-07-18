import { performance } from "node:perf_hooks";

import type {
  DashboardAgentActivityItem,
  DashboardKpiCard,
  DashboardOperationsSummaryItem,
  DashboardPreviewService,
  DashboardProposalQueueItem,
  DashboardProposalStatus,
  DashboardRiskItem,
  DashboardSystemHealthItem,
  DashboardViewModel,
} from "../../presentation/index.js";
import { dashboardPreviewService } from "../../presentation/index.js";
import type {
  ApprovalRecord,
  ApprovalRepository,
  AuditRecord,
  AuditRepository,
  ExecutionRecord,
  ExecutionRepository,
  WorkflowRecord,
  WorkflowRepository,
} from "../repositories/index.js";
import type { ProcessLocalMetricsRegistry } from "../observability/index.js";
import type { TenantContext } from "../tenant/index.js";

const DASHBOARD_ACTIVITY_LIMIT = 5;

export type DashboardClock = () => string;

export class DashboardAggregationService {
  public constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly approvalRepository: ApprovalRepository,
    private readonly auditRepository: AuditRepository,
    private readonly executionRepository: ExecutionRepository,
    private readonly previewService: DashboardPreviewService = dashboardPreviewService,
    private readonly now: DashboardClock = () => new Date().toISOString(),
    private readonly observability: {
      readonly metrics?: ProcessLocalMetricsRegistry;
      readonly durationNow?: () => number;
    } = {},
  ) {}

  public getDashboardSnapshot(tenant: TenantContext): DashboardViewModel {
    const durationNow = this.observability.durationNow ?? (() => performance.now());
    const startedAt = durationNow();
    const workflows = this.workflowRepository.list(tenant);
    const approvals = this.approvalRepository.list(tenant);
    const audits = this.auditRepository.list(tenant);
    const executions = this.executionRepository.list(tenant);
    const preview = this.previewService.createViewModel();
    const generatedAt = this.now();

    const snapshot: DashboardViewModel = {
      ...preview,
      heroBadges: ["Operational", "Repository Snapshot", "Execution Disabled"],
      kpis: this.createKpis(workflows, approvals, audits, executions),
      operationsSummary: this.createOperationsSummary(workflows, approvals, audits, executions),
      proposalQueue: this.createProposalQueue(approvals),
      agentActivity: this.createRecentActivity(audits),
      systemHealth: this.createSystemHealth(generatedAt, tenant),
      notifications: [
        {
          title: "Dashboard is read-only",
          detail: "This view observes current in-memory SAIE repository state and exposes no mutation controls.",
        },
        {
          title: "Tenant context is process-local",
          detail: `tenantId=${tenant.tenantId}; storeId=${tenant.storeId}; authenticationEnforced=false.`,
        },
        {
          title: "Execution remains disabled",
          detail: "Prepared execution records are review evidence only; no workflow is started or published.",
        },
        ...preview.notifications.slice(3),
      ],
      executiveRisks: this.createExecutiveRisks(preview.executiveRisks),
      approvalCenter: {
        title: "Approval Center Preview",
        items: this.createApprovalCenterItems(approvals),
      },
      releaseTimeline: [
        ...preview.releaseTimeline.filter((item) => item.label !== "SAIE-01.13 Enterprise Console Preview"),
        { label: "SAIE-02.07 Live Dashboard API", status: "Current" },
      ],
      executableActions: [],
    };

    this.observability.metrics?.incrementCounter("saie_dashboard_snapshots_total");
    this.observability.metrics?.observeDuration(
      "saie_dashboard_snapshot_duration_ms",
      durationNow() - startedAt,
    );
    this.observability.metrics?.setGauge("saie_workflows_current", workflows.length);
    this.observability.metrics?.setGauge("saie_approvals_current", approvals.length);
    this.observability.metrics?.setGauge("saie_audits_current", audits.length);
    this.observability.metrics?.setGauge("saie_executions_current", executions.length);

    return snapshot;
  }

  private createKpis(
    workflows: readonly WorkflowRecord[],
    approvals: readonly ApprovalRecord[],
    audits: readonly AuditRecord[],
    executions: readonly ExecutionRecord[],
  ): readonly DashboardKpiCard[] {
    const approvalCounts = this.countApprovals(approvals);
    const auditCounts = this.countAudits(audits);

    return [
      { label: "Total workflows", value: String(workflows.length), detail: "Repository-backed definitions" },
      { label: "Pending approvals", value: String(approvalCounts.pending), detail: "Awaiting human review" },
      { label: "Approved approvals", value: String(approvalCounts.approved), detail: "Eligible for internal preparation" },
      { label: "Rejected approvals", value: String(approvalCounts.rejected), detail: "Blocked from preparation" },
      { label: "Total audit events", value: String(audits.length), detail: "Preview and live audit records" },
      { label: "Live audit events", value: String(auditCounts.live), detail: "In-memory events from controlled actions" },
      { label: "Prepared executions", value: String(this.countExecutions(executions, "prepared")), detail: "Not executed" },
      { label: "Execution mode", value: "Disabled", detail: "executionEnabled remains false" },
    ];
  }

  private createOperationsSummary(
    workflows: readonly WorkflowRecord[],
    approvals: readonly ApprovalRecord[],
    audits: readonly AuditRecord[],
    executions: readonly ExecutionRecord[],
  ): readonly DashboardOperationsSummaryItem[] {
    const approvalCounts = this.countApprovals(approvals);
    const auditCounts = this.countAudits(audits);

    return [
      { label: "Workflow records", value: String(workflows.length), detail: "Read once for this snapshot" },
      { label: "Approval records", value: String(approvals.length), detail: `${approvalCounts.pending} pending` },
      { label: "Audit records", value: String(audits.length), detail: `${auditCounts.preview} preview / ${auditCounts.live} live` },
      { label: "Execution records", value: String(executions.length), detail: "Preview and prepared records" },
      { label: "Prepared executions", value: String(this.countExecutions(executions, "prepared")), detail: "Awaiting future controls" },
      { label: "Blocked executions", value: String(this.countExecutions(executions, "blocked")), detail: "Safety blocked records" },
    ];
  }

  private createProposalQueue(approvals: readonly ApprovalRecord[]): readonly DashboardProposalQueueItem[] {
    return [...approvals]
      .sort((left, right) => this.approvalStatusRank(left) - this.approvalStatusRank(right))
      .map((approval) => ({
        proposalType: approval.title,
        originatingAgent: approval.requestedBy,
        status: this.toProposalStatus(approval),
        readiness: this.approvalReadiness(approval),
        approvalRequirement: approval.requiresHumanApproval ? "Human review required" : "Human review unavailable",
        lastPreviewUpdate: approval.decidedAt ?? approval.requestedAt,
      }));
  }

  private createRecentActivity(audits: readonly AuditRecord[]): readonly DashboardAgentActivityItem[] {
    return [...audits]
      .sort((left, right) => {
        const sequenceDifference = right.sequence - left.sequence;
        return sequenceDifference === 0 ? left.id.localeCompare(right.id) : sequenceDifference;
      })
      .slice(0, DASHBOARD_ACTIVITY_LIMIT)
      .map((audit) => ({
        agent: audit.actor,
        activityType: `${audit.eventType} | ${audit.summary}`,
        status: audit.source === "in-memory-live" ? "READY_FOR_REVIEW" : "NEEDS_INPUT",
        previewTimestamp: `${audit.occurredAt} | ${audit.source}`,
      }));
  }

  private createSystemHealth(generatedAt: string, tenant: TenantContext): readonly DashboardSystemHealthItem[] {
    return [
      { component: "SAIE API", status: "HEALTHY", note: "Dashboard route is available." },
      { component: "Repository Snapshot", status: "HEALTHY", note: `In-memory snapshot generated at ${generatedAt}.` },
      {
        component: "Tenant Context",
        status: "LIMITED",
        note: `tenantId=${tenant.tenantId}; storeId=${tenant.storeId}; shopDomain=${tenant.shopDomain ?? "not-configured"}.`,
      },
      {
        component: "Tenant Isolation",
        status: "LIMITED",
        note: "storageMode=process-local; tenantIsolation=process-local; authenticationEnforced=false.",
      },
      { component: "Approval Safety", status: "READY", note: "Human approval remains required." },
      { component: "Controlled Execution", status: "LIMITED", note: "Execution is disabled; prepared records are not run." },
      { component: "External Integrations", status: "LIMITED", note: "External systems are not checked by this dashboard." },
      { component: "Storage Mode", status: "LIMITED", note: "Repository state is in-memory only for Beta." },
    ];
  }

  private createApprovalCenterItems(approvals: readonly ApprovalRecord[]): readonly string[] {
    const approvalCounts = this.countApprovals(approvals);

    return [
      `${approvalCounts.pending} pending approvals`,
      `${approvalCounts.approved} approved approvals`,
      `${approvalCounts.rejected} rejected approvals`,
      "No dashboard action buttons",
      "Execution preparation remains internal",
    ];
  }

  private createExecutiveRisks(previewRisks: readonly DashboardRiskItem[]): readonly DashboardRiskItem[] {
    return [
      { limitation: "In-memory-only persistence", impact: "Dashboard state resets when the process restarts." },
      { limitation: "Unauthenticated decidedBy identity", impact: "Human actor names are accepted as request input." },
      { limitation: "Non-atomic approval/audit operation", impact: "Approval state and audit recording are coordinated without transactions." },
      { limitation: "Non-atomic execution/audit operation", impact: "Prepared execution records and audit recording are coordinated without transactions." },
      { limitation: "Known Shopify OAuth HMAC test failures", impact: "OAuth test failures remain visible and separate from SAIE dashboard behavior." },
      ...previewRisks.filter(
        (risk) => risk.limitation === "No RBAC" || risk.limitation === "Process-local tenant isolation",
      ),
    ];
  }

  private countApprovals(approvals: readonly ApprovalRecord[]): {
    readonly pending: number;
    readonly approved: number;
    readonly rejected: number;
  } {
    return {
      pending: approvals.filter((approval) => approval.status === "pending").length,
      approved: approvals.filter((approval) => approval.status === "approved").length,
      rejected: approvals.filter((approval) => approval.status === "rejected").length,
    };
  }

  private countAudits(audits: readonly AuditRecord[]): { readonly preview: number; readonly live: number } {
    return {
      preview: audits.filter((audit) => audit.source === "deterministic-preview").length,
      live: audits.filter((audit) => audit.source === "in-memory-live").length,
    };
  }

  private countExecutions(
    executions: readonly ExecutionRecord[],
    status: ExecutionRecord["status"],
  ): number {
    return executions.filter((execution) => execution.status === status).length;
  }

  private approvalStatusRank(approval: ApprovalRecord): number {
    if (approval.status === "pending") {
      return 0;
    }

    if (approval.status === "approved") {
      return 1;
    }

    return 2;
  }

  private toProposalStatus(approval: ApprovalRecord): DashboardProposalStatus {
    if (approval.status === "rejected") {
      return "BLOCKED";
    }

    return approval.riskLevel === "MEDIUM" ? "NEEDS_INPUT" : "READY_FOR_REVIEW";
  }

  private approvalReadiness(approval: ApprovalRecord): string {
    if (approval.status === "approved") {
      return "Approved for internal preparation";
    }

    if (approval.status === "rejected") {
      return "Rejected by human reviewer";
    }

    return `Pending review | Risk ${approval.riskLevel}`;
  }
}
