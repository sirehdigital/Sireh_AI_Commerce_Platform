import { DEFAULT_TENANT_CONTEXT, type AuditRecord, type TenantContext } from "../../application/index.js";
import type { DashboardAgentActivityItem, DashboardPreviewService } from "../../presentation/index.js";
import { dashboardPreviewService } from "../../presentation/index.js";

export const createDeterministicAuditSeedRecords = (
  dashboardService: DashboardPreviewService = dashboardPreviewService,
  context: TenantContext = DEFAULT_TENANT_CONTEXT,
): readonly AuditRecord[] =>
  dashboardService.createViewModel().agentActivity.map((activity, index) =>
    toAuditRecord(activity, index + 1, context),
  );

const toAuditRecord = (
  activity: DashboardAgentActivityItem,
  sequence: number,
  context: TenantContext,
): AuditRecord => {
  const id = `audit-${slug(activity.agent)}-${String(sequence).padStart(2, "0")}`;

  return {
    tenantId: context.tenantId,
    storeId: context.storeId,
    ...(context.shopDomain === undefined ? {} : { shopDomain: context.shopDomain }),
    id,
    eventType: "preview.agent-activity",
    entityType: "agent-activity",
    entityId: id,
    actor: activity.agent,
    occurredAt: activity.previewTimestamp,
    summary: activity.activityType,
    details: {
      agent: activity.agent,
      activityType: activity.activityType,
      status: activity.status,
    },
    source: "deterministic-preview",
    sequence,
    activityType: activity.activityType,
    status: activity.status,
    recordedAt: activity.previewTimestamp,
    evidence: "Deterministic preview activity only; not persisted audit evidence.",
  };
};

const slug = (value: string): string =>
  value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
