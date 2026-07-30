import { randomUUID } from "node:crypto";

import { Router, type Request, type RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { DEFAULT_TENANT_CONTEXT, ProcessLocalTenantRegistry } from "../../saie/application/index.js";
import { prismaApprovalRepository, prismaAuditRepository } from "../../saie/infrastructure/index.js";
import {
  ContentGenerationService,
  ContentReviewService,
  MarketingCampaignService,
  MarketingStrategyService,
  MarketingWorkflowService,
  type CreateMarketingContentInput,
  type CreateMarketingCampaignInput,
  type CreateMarketingStrategyInput,
  type CreateMarketingWorkflowInput,
  type ReviewMarketingContentInput,
  type ValidateMarketingContentInput,
} from "../application/index.js";
import type {
  CampaignStatus,
  MarketingChannelType,
  MarketingContentType,
  MarketingContentVariant,
  MarketingContentWorkflowState,
  MarketingGoalType,
  MarketingRepository,
  MarketingWorkflowStage,
} from "../domain/index.js";
import { InMemoryMarketingRepository } from "../infrastructure/index.js";

const CAMPAIGN_STATUSES = new Set(["DRAFT", "PLANNED", "READY_FOR_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "COMPLETED", "CANCELLED"]);
const GOALS = new Set(["BRAND_AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEAD_GENERATION", "SALES", "RETENTION", "UPSELL", "CROSS_SELL"]);
const CHANNELS = new Set(["SHOPIFY", "EMAIL", "FACEBOOK", "INSTAGRAM", "TIKTOK", "THREADS", "PINTEREST", "BLOG"]);
const CONTENT_TYPES = new Set(["PRODUCT_DESCRIPTION", "SHORT_DESCRIPTION", "HEADLINE", "HOOK", "CALL_TO_ACTION", "BENEFITS", "FEATURES", "FAQ", "EMAIL_SUBJECT", "EMAIL_BODY", "BLOG_OUTLINE", "META_TITLE", "META_DESCRIPTION", "KEYWORDS", "SOCIAL_CAPTION", "HASHTAGS"]);
const CONTENT_VARIANTS = new Set(["SHORT", "MEDIUM", "LONG", "PROFESSIONAL", "FRIENDLY", "LUXURY", "MINIMAL"]);
const CONTENT_WORKFLOW_STATES = new Set(["Draft", "Generate", "Review", "Approve", "Ready For Publishing"]);
const WORKFLOW_STAGES = new Set(["Draft", "Planning", "Review", "Approval", "Scheduling", "Publishing", "Monitoring", "Completion"]);

export interface MarketingRouterOptions {
  readonly campaignService?: MarketingCampaignService;
  readonly contentGenerationService?: ContentGenerationService;
  readonly contentReviewService?: ContentReviewService;
  readonly strategyService?: MarketingStrategyService;
  readonly workflowService?: MarketingWorkflowService;
  readonly repository?: MarketingRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export const createMarketingRouter = (options: MarketingRouterOptions = {}): Router => {
  const router = Router();
  const repository = options.repository ?? new InMemoryMarketingRepository();
  const dependencies = {
    repository,
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
    now: options.now ?? (() => new Date()),
    idGenerator: options.idGenerator ?? randomUUID,
  };
  const campaignService = options.campaignService ?? new MarketingCampaignService(dependencies);
  const contentGenerationService = options.contentGenerationService ?? new ContentGenerationService(dependencies);
  const contentReviewService = options.contentReviewService ?? new ContentReviewService(dependencies);
  const strategyService = options.strategyService ?? new MarketingStrategyService(dependencies);
  const workflowService = options.workflowService ?? new MarketingWorkflowService(dependencies);

  router.post("/content", asyncHandler(async (request, response) => {
    const content = await contentGenerationService.generate(parseContentInput(request), resolveTenant(request));
    response.status(201).json({ success: true, data: content });
  }));

  router.get("/content", asyncHandler(async (request, response) => {
    const result = await contentGenerationService.list({
      ...optionalTextField("campaignId", request.query.campaignId),
      ...optionalField("channel", parseOptionalChannel(request.query.channel)),
      ...optionalField("workflowState", parseOptionalContentWorkflowState(request.query.workflowState)),
      ...optionalField("limit", parseOptionalInteger(request.query.limit, "limit")),
      ...optionalField("offset", parseOptionalInteger(request.query.offset, "offset")),
    }, resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  router.post("/content/review", asyncHandler(async (request, response) => {
    const content = await contentReviewService.review(parseContentReviewInput(request), resolveTenant(request));
    response.status(200).json({ success: true, data: content });
  }));

  router.post("/content/validate", asyncHandler(async (request, response) => {
    const validation = await contentGenerationService.validate(parseContentValidationInput(request), resolveTenant(request));
    response.status(200).json({ success: true, data: validation });
  }));

  router.get("/content/:contentId", asyncHandler(async (request, response) => {
    const content = await contentGenerationService.get(parseRequiredText(request.params.contentId, "contentId"), resolveTenant(request));
    response.status(200).json({ success: true, data: content });
  }));

  router.post("/campaigns", asyncHandler(async (request, response) => {
    const result = await campaignService.create(parseCampaignInput(request), resolveTenant(request));
    response.status(201).json({ success: true, data: result });
  }));

  router.get("/campaigns", asyncHandler(async (request, response) => {
    const result = await campaignService.list({
      ...optionalField("status", parseOptionalStatus(request.query.status)),
      ...optionalField("limit", parseOptionalInteger(request.query.limit, "limit")),
      ...optionalField("offset", parseOptionalInteger(request.query.offset, "offset")),
    }, resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  router.get("/campaigns/:campaignId", asyncHandler(async (request, response) => {
    const campaign = await campaignService.get(parseRequiredText(request.params.campaignId, "campaignId"), resolveTenant(request));
    response.status(200).json({ success: true, data: campaign });
  }));

  router.post("/strategies", asyncHandler(async (request, response) => {
    const strategy = await strategyService.create(parseStrategyInput(request), resolveTenant(request));
    response.status(201).json({ success: true, data: strategy });
  }));

  router.get("/strategies", asyncHandler(async (request, response) => {
    const strategies = await strategyService.list(resolveTenant(request));
    response.status(200).json({ success: true, data: strategies });
  }));

  router.post("/workflows", asyncHandler(async (request, response) => {
    const workflow = await workflowService.create(parseWorkflowInput(request), resolveTenant(request));
    response.status(201).json({ success: true, data: workflow });
  }));

  router.get("/workflows", asyncHandler(async (_request, response) => {
    const workflows = await workflowService.list(resolveTenant(_request));
    response.status(200).json({ success: true, data: workflows });
  }));

  return router;
};

function parseContentInput(request: Request): CreateMarketingContentInput {
  const body = asRecord(request.body, "body");
  return {
    ...optionalTextField("campaignId", body.campaignId),
    ...optionalTextField("strategyId", body.strategyId),
    name: parseRequiredText(body.name, "name"),
    brandName: parseRequiredText(body.brandName, "brandName"),
    productName: parseRequiredText(body.productName, "productName"),
    audienceName: parseRequiredText(body.audienceName, "audienceName"),
    ...(body.audienceSegments === undefined ? {} : { audienceSegments: parseStringArray(body.audienceSegments, "audienceSegments") }),
    goalType: parseGoal(body.goalType),
    channel: parseChannel(body.channel),
    ...(body.variant === undefined ? {} : { variant: parseContentVariant(body.variant) }),
    contentTypes: parseContentTypes(body.contentTypes),
    ...(body.benefits === undefined ? {} : { benefits: parseStringArray(body.benefits, "benefits") }),
    ...(body.features === undefined ? {} : { features: parseStringArray(body.features, "features") }),
    ...(body.keywords === undefined ? {} : { keywords: parseStringArray(body.keywords, "keywords") }),
    ...optionalTextField("callToAction", body.callToAction),
    ...optionalTextField("requestedBy", body.requestedBy),
    ...optionalTextField("correlationId", body.correlationId),
  };
}

function parseContentReviewInput(request: Request): ReviewMarketingContentInput {
  const body = asRecord(request.body, "body");
  return {
    contentId: parseRequiredText(body.contentId, "contentId"),
    ...(body.decision === undefined ? {} : { decision: parseReviewDecision(body.decision) }),
    ...optionalTextField("requestedBy", body.requestedBy),
    ...optionalTextField("correlationId", body.correlationId),
  };
}

function parseContentValidationInput(request: Request): ValidateMarketingContentInput {
  const body = asRecord(request.body, "body");
  return {
    ...optionalTextField("contentId", body.contentId),
    ...(body.content === undefined ? {} : { content: parseContentPayload(body.content) }),
  };
}

function parseContentPayload(value: unknown): CreateMarketingContentInput {
  return parseContentInput({ body: value } as Request);
}

function parseCampaignInput(request: Request): CreateMarketingCampaignInput {
  const body = asRecord(request.body, "body");
  return {
    name: parseRequiredText(body.name, "name"),
    goalType: parseGoal(body.goalType),
    ...optionalTextField("goalDescription", body.goalDescription),
    ...optionalTextField("targetMetric", body.targetMetric),
    audienceName: parseRequiredText(body.audienceName, "audienceName"),
    ...optionalTextField("audienceDescription", body.audienceDescription),
    ...(body.audienceSegments === undefined ? {} : { audienceSegments: parseStringArray(body.audienceSegments, "audienceSegments") }),
    ...(body.markets === undefined ? {} : { markets: parseStringArray(body.markets, "markets") }),
    primaryChannel: parseChannel(body.primaryChannel),
    ...(body.secondaryChannels === undefined ? {} : { secondaryChannels: parseChannels(body.secondaryChannels, "secondaryChannels") }),
    startsAt: parseRequiredText(body.startsAt, "startsAt"),
    endsAt: parseRequiredText(body.endsAt, "endsAt"),
    ...optionalTextField("timezone", body.timezone),
    budgetAmount: parseNumber(body.budgetAmount, "budgetAmount"),
    budgetCurrency: parseRequiredText(body.budgetCurrency, "budgetCurrency"),
    ...optionalTextField("requestedBy", body.requestedBy),
    ...optionalTextField("correlationId", body.correlationId),
  };
}

function parseStrategyInput(request: Request): CreateMarketingStrategyInput {
  const body = asRecord(request.body, "body");
  return {
    ...optionalTextField("campaignId", body.campaignId),
    name: parseRequiredText(body.name, "name"),
    goalType: parseGoal(body.goalType),
    audienceName: parseRequiredText(body.audienceName, "audienceName"),
    primaryChannel: parseChannel(body.primaryChannel),
    ...(body.secondaryChannels === undefined ? {} : { secondaryChannels: parseChannels(body.secondaryChannels, "secondaryChannels") }),
    ...optionalTextField("positioning", body.positioning),
  };
}

function parseWorkflowInput(request: Request): CreateMarketingWorkflowInput {
  const body = asRecord(request.body, "body");
  return {
    name: parseRequiredText(body.name, "name"),
    ...(body.stages === undefined ? {} : { stages: parseWorkflowStages(body.stages) }),
    ...(body.approvalRequired === undefined ? {} : { approvalRequired: body.approvalRequired === true }),
  };
}

const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

function resolveTenant(request: Request) {
  const registry = new ProcessLocalTenantRegistry([DEFAULT_TENANT_CONTEXT]);
  return registry.resolveTenant({
    tenantId: parseOptionalHeader(request, "x-saie-tenant-id") ?? DEFAULT_TENANT_CONTEXT.tenantId,
    storeId: parseOptionalHeader(request, "x-saie-store-id") ?? DEFAULT_TENANT_CONTEXT.storeId,
    shopDomain: parseOptionalHeader(request, "x-saie-shop-domain"),
  });
}

function parseOptionalStatus(value: unknown): CampaignStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  const status = parseRequiredText(value, "status");
  if (!CAMPAIGN_STATUSES.has(status)) {
    throw AppError.badRequest("Marketing campaign status is invalid.", { field: "status" }, "MARKETING_STATUS_INVALID");
  }
  return status as CampaignStatus;
}

function parseContentTypes(value: unknown): readonly MarketingContentType[] {
  return parseStringArray(value, "contentTypes").map((item) => {
    if (!CONTENT_TYPES.has(item)) {
      throw AppError.badRequest("Marketing content type is invalid.", { field: "contentTypes" }, "MARKETING_CONTENT_TYPE_INVALID");
    }
    return item as MarketingContentType;
  });
}

function parseContentVariant(value: unknown): MarketingContentVariant {
  const variant = parseRequiredText(value, "variant");
  if (!CONTENT_VARIANTS.has(variant)) {
    throw AppError.badRequest("Marketing content variant is invalid.", { field: "variant" }, "MARKETING_CONTENT_VARIANT_INVALID");
  }
  return variant as MarketingContentVariant;
}

function parseOptionalContentWorkflowState(value: unknown): MarketingContentWorkflowState | undefined {
  if (value === undefined) {
    return undefined;
  }
  const workflowState = parseRequiredText(value, "workflowState");
  if (!CONTENT_WORKFLOW_STATES.has(workflowState)) {
    throw AppError.badRequest("Marketing content workflow state is invalid.", { field: "workflowState" }, "MARKETING_CONTENT_WORKFLOW_STATE_INVALID");
  }
  return workflowState as MarketingContentWorkflowState;
}

function parseReviewDecision(value: unknown): "APPROVED" | "REJECTED" {
  const decision = parseRequiredText(value, "decision");
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw AppError.badRequest("Marketing content review decision is invalid.", { field: "decision" }, "MARKETING_CONTENT_REVIEW_DECISION_INVALID");
  }
  return decision;
}

function parseGoal(value: unknown): MarketingGoalType {
  const goal = parseRequiredText(value, "goalType");
  if (!GOALS.has(goal)) {
    throw AppError.badRequest("Marketing goal is invalid.", { field: "goalType" }, "MARKETING_GOAL_INVALID");
  }
  return goal as MarketingGoalType;
}

function parseChannel(value: unknown): MarketingChannelType {
  const channel = parseRequiredText(value, "channel");
  if (!CHANNELS.has(channel)) {
    throw AppError.badRequest("Marketing channel is invalid.", { field: "channel" }, "MARKETING_CHANNEL_INVALID");
  }
  return channel as MarketingChannelType;
}

function parseOptionalChannel(value: unknown): MarketingChannelType | undefined {
  return value === undefined ? undefined : parseChannel(value);
}

function parseChannels(value: unknown, field: string): readonly MarketingChannelType[] {
  return parseStringArray(value, field).map((item) => parseChannel(item));
}

function parseWorkflowStages(value: unknown): readonly MarketingWorkflowStage[] {
  return parseStringArray(value, "stages").map((stage) => {
    if (!WORKFLOW_STAGES.has(stage)) {
      throw AppError.badRequest("Marketing workflow stage is invalid.", { field: "stages" }, "MARKETING_WORKFLOW_STAGE_INVALID");
    }
    return stage as MarketingWorkflowStage;
  });
}

function parseStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw AppError.badRequest("Field must be an array of strings.", { field }, "MARKETING_ARRAY_FIELD_INVALID");
  }
  return value.map((item) => parseRequiredText(item, field));
}

function parseOptionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(parseRequiredText(value, field), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw AppError.badRequest("Query parameter must be a non-negative integer.", { field }, "MARKETING_QUERY_INVALID");
  }
  return parsed;
}

function parseNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(parseRequiredText(value, field));
  if (!Number.isFinite(parsed)) {
    throw AppError.badRequest("Field must be a finite number.", { field }, "MARKETING_NUMBER_INVALID");
  }
  return parsed;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw AppError.badRequest("Request body must be an object.", { field }, "MARKETING_BODY_INVALID");
  }
  return value as Record<string, unknown>;
}

function parseRequiredText(value: unknown, field: string): string {
  const text = parseOptionalText(value);
  if (text === undefined) {
    throw AppError.badRequest("Required text field is missing.", { field }, "MARKETING_REQUIRED_FIELD_MISSING");
  }
  return text;
}

function parseOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const text = value.trim();
  return text.length === 0 ? undefined : text;
}

function parseOptionalHeader(request: Request, name: string): string | undefined {
  return parseOptionalText(request.header(name));
}

function optionalTextField<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
  const text = parseOptionalText(value);
  return text === undefined ? {} : ({ [key]: text } as Record<Key, string>);
}

function optionalField<Key extends string, Value>(key: Key, value: Value | undefined): Partial<Record<Key, Value>> {
  return value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);
}

export const marketingRouter = createMarketingRouter();
