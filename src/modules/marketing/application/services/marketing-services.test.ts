import { describe, expect, it } from "vitest";

import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { InMemoryMarketingRepository } from "../../infrastructure/index.js";
import {
  CampaignPlanningService,
  CampaignValidationService,
  MarketingCampaignService,
  MarketingStrategyService,
  MarketingWorkflowService,
} from "./marketing-services.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T16:00:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `marketing-id-${(id += 1).toString().padStart(3, "0")}`;
};

const campaignInput = {
  name: "Lumora Summer Glow",
  goalType: "SALES" as const,
  audienceName: "Beauty shoppers",
  audienceSegments: ["skincare", "body care"],
  markets: ["US"],
  primaryChannel: "EMAIL" as const,
  secondaryChannels: ["INSTAGRAM", "BLOG"] as const,
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: "2026-08-31T23:59:59.000Z",
  budgetAmount: 500,
  budgetCurrency: "USD",
  requestedBy: "merchant",
};

describe("Marketing Intelligence foundation services", () => {
  it("creates immutable campaign foundations with planning, approval, and audit metadata", async () => {
    const repository = new InMemoryMarketingRepository();
    const approvalRepository = new InMemoryApprovalRepository([]);
    const auditRepository = new InMemoryAuditRepository();
    const service = new MarketingCampaignService({
      repository,
      approvalRepository,
      auditRepository,
      now: () => now,
      idGenerator: idGenerator(),
    });

    const result = await service.create(campaignInput, tenant);

    expect(result.campaign).toMatchObject({
      name: "Lumora Summer Glow",
      status: "READY_FOR_REVIEW",
      goal: { type: "SALES" },
      contentPlan: { copyGenerationAllowed: false },
      publishingPlan: { publishingAllowed: false, schedulingExecutionAllowed: false },
      validation: { errors: [], approvalRequired: true, executionReady: true },
    });
    expect(result.plan).toMatchObject({
      primaryChannel: "EMAIL",
      secondaryChannels: ["INSTAGRAM", "BLOG"],
      approvalRequired: true,
      executionReadiness: "READY_FOR_REVIEW",
    });
    expect(result.campaign.approvalId).toBeDefined();
    expect(approvalRepository.findById(tenant, result.campaign.approvalId!)).toMatchObject({
      status: "pending",
      executionEnabled: false,
    });
    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toEqual(expect.arrayContaining([
      "MARKETING_CAMPAIGN_CREATED",
      "MARKETING_PLAN_CREATED",
      "MARKETING_PLAN_VALIDATED",
    ]));
  });

  it("validates malformed campaign inputs deterministically", () => {
    const validation = new CampaignValidationService().validate({
      name: "No",
      goal: { type: "TRAFFIC", description: "Traffic", targetMetric: "sessions" },
      audience: { id: "audience", name: "", description: "", segments: [], markets: [] },
      channels: [],
      schedule: { startsAt: "2026-08-31T00:00:00.000Z", endsAt: "2026-08-01T00:00:00.000Z", timezone: "UTC" },
      budget: { amount: -1, currency: "US", allocationNotes: [] },
      status: "READY_FOR_REVIEW",
    });

    expect(validation.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "CAMPAIGN_NAME_INVALID",
      "CAMPAIGN_AUDIENCE_INVALID",
      "CAMPAIGN_CHANNEL_INVALID",
      "CAMPAIGN_SCHEDULE_INVALID",
      "CAMPAIGN_BUDGET_INVALID",
      "CAMPAIGN_APPROVAL_REFERENCE_MISSING",
    ]));
  });

  it("creates strategy and workflow records without enabling execution", async () => {
    const repository = new InMemoryMarketingRepository();
    const strategyService = new MarketingStrategyService({ repository, now: () => now, idGenerator: idGenerator() });
    const workflowService = new MarketingWorkflowService({ repository, now: () => now, idGenerator: idGenerator() });

    const strategy = await strategyService.create({
      name: "Retention Plan",
      goalType: "RETENTION",
      audienceName: "Repeat buyers",
      primaryChannel: "EMAIL",
      secondaryChannels: ["SHOPIFY"],
    }, tenant);
    const workflow = await workflowService.create({ name: "Foundation Workflow" }, tenant);

    expect(strategy).toMatchObject({
      approvalRequired: true,
      executionReadiness: "READY_FOR_REVIEW",
      primaryChannel: "EMAIL",
    });
    expect(workflow).toMatchObject({
      approvalRequired: true,
      executionEnabled: false,
      currentStage: "Draft",
    });
    await expect(strategyService.list(tenant)).resolves.toHaveLength(1);
    await expect(workflowService.list(tenant)).resolves.toHaveLength(1);
  });

  it("builds campaign planning output from a stored campaign", async () => {
    const repository = new InMemoryMarketingRepository();
    const service = new MarketingCampaignService({
      repository,
      approvalRepository: new InMemoryApprovalRepository([]),
      now: () => now,
      idGenerator: idGenerator(),
    });
    const result = await service.create(campaignInput, tenant);

    const plan = new CampaignPlanningService().plan(result.campaign);

    expect(plan.contentRequirements.join(" ")).toContain("copy generation disabled");
    expect(plan.publishingRequirements.join(" ")).toContain("publishing execution disabled");
  });
});
