import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../saie/infrastructure/index.js";
import {
  ContentGenerationService,
  ContentReviewService,
  MarketingCampaignService,
  MarketingStrategyService,
  MarketingWorkflowService,
} from "../application/index.js";
import { InMemoryMarketingRepository } from "../infrastructure/index.js";
import { createMarketingRouter } from "./marketing.routes.js";

const now = new Date("2026-07-30T16:20:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `api-marketing-id-${(id += 1).toString().padStart(3, "0")}`;
};

const payload = {
  name: "Lumora Journal Launch",
  goalType: "ENGAGEMENT",
  audienceName: "Skincare enthusiasts",
  audienceSegments: ["journal subscribers"],
  primaryChannel: "BLOG",
  secondaryChannels: ["EMAIL", "PINTEREST"],
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: "2026-08-15T00:00:00.000Z",
  budgetAmount: 250,
  budgetCurrency: "USD",
};

const createApp = () => {
  const repository = new InMemoryMarketingRepository();
  const dependencies = {
    repository,
    approvalRepository: new InMemoryApprovalRepository([]),
    auditRepository: new InMemoryAuditRepository(),
    now: () => now,
    idGenerator: idGenerator(),
  };
  const app = express();
  app.use(express.json());
  app.use("/marketing", createMarketingRouter({
    repository,
    campaignService: new MarketingCampaignService(dependencies),
    contentGenerationService: new ContentGenerationService(dependencies),
    contentReviewService: new ContentReviewService(dependencies),
    strategyService: new MarketingStrategyService(dependencies),
    workflowService: new MarketingWorkflowService(dependencies),
  }));
  app.use(errorHandler);
  return app;
};

interface SuccessBody<TData> {
  readonly success: true;
  readonly data: TData;
}

const successBody = <TData>(body: unknown): SuccessBody<TData> => body as SuccessBody<TData>;

describe("marketing foundation API routes", () => {
  it("creates and reads campaign foundations", async () => {
    const app = createApp();
    const created = await request(app).post("/marketing/campaigns").send(payload).expect(201);
    const campaign = successBody<{ readonly campaign: { readonly id: string; readonly status: string }; readonly plan: { readonly primaryChannel: string } }>(created.body as unknown).data;

    expect(campaign.campaign.status).toBe("READY_FOR_REVIEW");
    expect(campaign.plan.primaryChannel).toBe("BLOG");
    await request(app).get("/marketing/campaigns").expect(200).expect((response) => {
      expect(successBody<{ readonly total: number; readonly items: readonly unknown[] }>(response.body as unknown).data).toMatchObject({
        total: 1,
      });
    });
    await request(app).get(`/marketing/campaigns/${campaign.campaign.id}`).expect(200).expect((response) => {
      expect(successBody<{ readonly id: string; readonly contentPlan: { readonly copyGenerationAllowed: boolean } }>(response.body as unknown).data).toMatchObject({
        id: campaign.campaign.id,
        contentPlan: { copyGenerationAllowed: false },
      });
    });
  });

  it("creates and lists strategies and workflows", async () => {
    const app = createApp();
    await request(app).post("/marketing/strategies").send({
      name: "Beauty and Nature Strategy",
      goalType: "BRAND_AWARENESS",
      audienceName: "Premium skincare buyers",
      primaryChannel: "INSTAGRAM",
      secondaryChannels: ["THREADS"],
    }).expect(201).expect((response) => {
      expect(successBody<{ readonly executionReadiness: string }>(response.body as unknown).data.executionReadiness).toBe("READY_FOR_REVIEW");
    });
    await request(app).get("/marketing/strategies").expect(200).expect((response) => {
      expect(successBody<readonly unknown[]>(response.body as unknown).data).toHaveLength(1);
    });
    await request(app).post("/marketing/workflows").send({ name: "Marketing Foundation Workflow" }).expect(201).expect((response) => {
      expect(successBody<{ readonly executionEnabled: boolean; readonly stages: readonly string[] }>(response.body as unknown).data).toMatchObject({
        executionEnabled: false,
      });
    });
    await request(app).get("/marketing/workflows").expect(200).expect((response) => {
      expect(successBody<readonly unknown[]>(response.body as unknown).data).toHaveLength(1);
    });
  });

  it("creates, validates, reviews, and reads deterministic content", async () => {
    const app = createApp();
    const created = await request(app).post("/marketing/content").send({
      name: "Velvet Glow Content",
      brandName: "Lumora Beauty",
      productName: "Velvet Glow",
      audienceName: "Beauty shoppers",
      goalType: "SALES",
      channel: "EMAIL",
      variant: "FRIENDLY",
      contentTypes: ["HEADLINE", "EMAIL_SUBJECT"],
      benefits: ["soft skin"],
      features: ["botanical oils"],
      keywords: ["body lotion", "glow"],
      callToAction: "Shop now",
    }).expect(201);
    const content = successBody<{ readonly id: string; readonly workflowState: string; readonly sections: readonly { readonly type: string }[] }>(created.body as unknown).data;

    expect(content.workflowState).toBe("Review");
    expect(content.sections.map((section) => section.type)).toEqual(expect.arrayContaining(["EMAIL_SUBJECT", "EMAIL_BODY", "CALL_TO_ACTION"]));
    await request(app).get("/marketing/content").expect(200).expect((response) => {
      expect(successBody<{ readonly total: number }>(response.body as unknown).data.total).toBe(1);
    });
    await request(app).get(`/marketing/content/${content.id}`).expect(200).expect((response) => {
      expect(successBody<{ readonly id: string }>(response.body as unknown).data.id).toBe(content.id);
    });
    await request(app).post("/marketing/content/validate").send({ contentId: content.id }).expect(200).expect((response) => {
      expect(successBody<{ readonly errors: readonly unknown[]; readonly readyForReview: boolean }>(response.body as unknown).data).toMatchObject({
        errors: [],
        readyForReview: true,
      });
    });
    await request(app).post("/marketing/content/review").send({ contentId: content.id, decision: "APPROVED" }).expect(200).expect((response) => {
      expect(successBody<{ readonly workflowState: string }>(response.body as unknown).data.workflowState).toBe("Ready For Publishing");
    });
  });

  it("rejects malformed campaign requests", async () => {
    const app = createApp();
    await request(app).post("/marketing/campaigns").send({ ...payload, goalType: "COPYWRITING" }).expect(400).expect((response) => {
      expect((response.body as { readonly error: { readonly code: string } }).error.code).toBe("MARKETING_GOAL_INVALID");
    });
  });

  it("keeps tenant records isolated", async () => {
    const app = createApp();
    const created = await request(app)
      .post("/marketing/campaigns")
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .send(payload)
      .expect(201);
    const campaignId = successBody<{ readonly campaign: { readonly id: string } }>(created.body as unknown).data.campaign.id;

    await request(app).get(`/marketing/campaigns/${campaignId}`).expect(404);
    await request(app)
      .get(`/marketing/campaigns/${campaignId}`)
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .expect(200);
  });
});
