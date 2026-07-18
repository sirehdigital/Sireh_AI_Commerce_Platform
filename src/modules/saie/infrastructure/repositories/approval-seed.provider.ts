import type { DashboardPreviewService, DashboardProposalStatus } from "../../presentation/index.js";
import { dashboardPreviewService } from "../../presentation/index.js";
import { DEFAULT_TENANT_CONTEXT, type ApprovalRecord, type ApprovalRiskLevel, type TenantContext } from "../../application/index.js";

const SEEDED_APPROVAL_WORKFLOW_ID = "shopify-product-orchestration";

export const createDeterministicApprovalSeedRecords = (
  dashboardService: DashboardPreviewService = dashboardPreviewService,
  context: TenantContext = DEFAULT_TENANT_CONTEXT,
): readonly ApprovalRecord[] =>
  dashboardService.createViewModel().proposalQueue.map((proposal, index) => {
    const requestedAt = `Preview approval ${String(index + 1).padStart(2, "0")}`;

    return {
      tenantId: context.tenantId,
      storeId: context.storeId,
      ...(context.shopDomain === undefined ? {} : { shopDomain: context.shopDomain }),
      id: `approval-${slug(proposal.proposalType)}`,
      proposalId: `proposal-${slug(proposal.proposalType)}`,
      workflowId: SEEDED_APPROVAL_WORKFLOW_ID,
      title: proposal.proposalType,
      status: "pending",
      riskLevel: toRiskLevel(proposal.status),
      requestedBy: proposal.originatingAgent,
      createdAt: requestedAt,
      requestedAt,
      requiresHumanApproval: true,
      executionEnabled: false,
      source: "deterministic-preview",
      version: 1,
    };
  });

const toRiskLevel = (status: DashboardProposalStatus): ApprovalRiskLevel => {
  if (status === "BLOCKED") {
    return "HIGH";
  }

  if (status === "NEEDS_INPUT") {
    return "MEDIUM";
  }

  return "LOW";
};

const slug = (value: string): string =>
  value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
