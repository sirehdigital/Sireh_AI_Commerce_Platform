import { randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type {
  CampaignBudget,
  CampaignPlanningResult,
  CampaignSchedule,
  CampaignStatus,
  CampaignValidationIssue,
  CampaignValidationReport,
  ContentPlan,
  MarketingAudience,
  MarketingCampaign,
  MarketingCampaignListQuery,
  MarketingChannel,
  MarketingChannelType,
  MarketingGoal,
  MarketingGoalType,
  MarketingRepository,
  MarketingStrategy,
  MarketingWorkflow,
  MarketingWorkflowStage,
  PublishingPlan,
} from "../../domain/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface MarketingApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface MarketingAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface MarketingServiceDependencies {
  readonly repository: MarketingRepository;
  readonly approvalRepository?: MarketingApprovalRepository;
  readonly auditRepository?: MarketingAuditRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export interface CreateMarketingCampaignInput {
  readonly name: string;
  readonly goalType: MarketingGoalType;
  readonly goalDescription?: string;
  readonly targetMetric?: string;
  readonly audienceName: string;
  readonly audienceDescription?: string;
  readonly audienceSegments?: readonly string[];
  readonly markets?: readonly string[];
  readonly primaryChannel: MarketingChannelType;
  readonly secondaryChannels?: readonly MarketingChannelType[];
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone?: string;
  readonly budgetAmount: number;
  readonly budgetCurrency: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface CreateMarketingStrategyInput {
  readonly campaignId?: string;
  readonly name: string;
  readonly goalType: MarketingGoalType;
  readonly audienceName: string;
  readonly primaryChannel: MarketingChannelType;
  readonly secondaryChannels?: readonly MarketingChannelType[];
  readonly positioning?: string;
}

export interface CreateMarketingWorkflowInput {
  readonly name: string;
  readonly stages?: readonly MarketingWorkflowStage[];
  readonly approvalRequired?: boolean;
}

const GOALS = new Set<MarketingGoalType>(["BRAND_AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEAD_GENERATION", "SALES", "RETENTION", "UPSELL", "CROSS_SELL"]);
const CHANNELS = new Set<MarketingChannelType>(["SHOPIFY", "EMAIL", "FACEBOOK", "INSTAGRAM", "TIKTOK", "THREADS", "PINTEREST", "BLOG"]);
const WORKFLOW: readonly MarketingWorkflowStage[] = ["Draft", "Planning", "Review", "Approval", "Scheduling", "Publishing", "Monitoring", "Completion"];

export class AudienceService {
  public create(input: Pick<CreateMarketingCampaignInput, "audienceName" | "audienceDescription" | "audienceSegments" | "markets">, id: string): MarketingAudience {
    const name = required(input.audienceName, "audienceName");
    return {
      id,
      name,
      description: optional(input.audienceDescription) ?? `${name} audience segment prepared for deterministic campaign planning.`,
      segments: unique(input.audienceSegments ?? [name]),
      markets: unique(input.markets ?? ["US"]),
    };
  }
}

export class CampaignValidationService {
  public validate(input: {
    readonly name: string;
    readonly goal: MarketingGoal;
    readonly audience: MarketingAudience;
    readonly channels: readonly MarketingChannel[];
    readonly schedule: CampaignSchedule;
    readonly budget: CampaignBudget;
    readonly workflow?: MarketingWorkflow;
    readonly approvalId?: string;
    readonly status?: CampaignStatus;
  }): CampaignValidationReport {
    const errors: CampaignValidationIssue[] = [];
    const warnings: CampaignValidationIssue[] = [];
    if (input.name.trim().length < 3) {
      errors.push(issue("CAMPAIGN_NAME_INVALID", "Campaign name must contain at least 3 characters.", "campaign.name"));
    }
    if (!GOALS.has(input.goal.type)) {
      errors.push(issue("CAMPAIGN_GOAL_INVALID", "Marketing goal is unsupported.", "campaign.goal"));
    }
    if (input.audience.name.trim().length === 0 || input.audience.segments.length === 0) {
      errors.push(issue("CAMPAIGN_AUDIENCE_INVALID", "Audience name and segments are required.", "campaign.audience"));
    }
    if (input.channels.length === 0 || !input.channels.some((channel) => channel.priority === "PRIMARY")) {
      errors.push(issue("CAMPAIGN_CHANNEL_INVALID", "A primary marketing channel is required.", "campaign.channels"));
    }
    if (input.channels.some((channel) => !CHANNELS.has(channel.type))) {
      errors.push(issue("CAMPAIGN_CHANNEL_UNSUPPORTED", "One or more marketing channels are unsupported.", "campaign.channels"));
    }
    if (Date.parse(input.schedule.startsAt) >= Date.parse(input.schedule.endsAt)) {
      errors.push(issue("CAMPAIGN_SCHEDULE_INVALID", "Campaign end time must be after start time.", "campaign.schedule"));
    }
    if (input.budget.amount < 0 || input.budget.currency.trim().length !== 3) {
      errors.push(issue("CAMPAIGN_BUDGET_INVALID", "Campaign budget must include a non-negative amount and ISO currency.", "campaign.budget"));
    }
    if (input.workflow !== undefined && !WORKFLOW.every((stage) => input.workflow?.stages.includes(stage) === true)) {
      warnings.push(issue("CAMPAIGN_WORKFLOW_INCOMPLETE", "Workflow should include the full foundation lifecycle.", "campaign.workflow", "WARNING"));
    }
    const approvalRequired = input.status === "READY_FOR_REVIEW" || input.status === "APPROVED" || input.status === "SCHEDULED" || input.status === "PUBLISHED";
    if (approvalRequired && input.approvalId === undefined) {
      errors.push(issue("CAMPAIGN_APPROVAL_REFERENCE_MISSING", "Approval reference is required before review or execution states.", "campaign.approvalId"));
    }
    return {
      errors,
      warnings,
      approvalRequired: true,
      executionReady: errors.length === 0 && input.approvalId !== undefined,
    };
  }
}

export class CampaignPlanningService {
  public plan(campaign: MarketingCampaign): CampaignPlanningResult {
    const primary = campaign.channels.find((channel) => channel.priority === "PRIMARY")?.type ?? "EMAIL";
    return {
      campaignId: campaign.id,
      campaignGoal: campaign.goal,
      audience: campaign.audience,
      primaryChannel: primary,
      secondaryChannels: campaign.channels.filter((channel) => channel.priority === "SECONDARY").map((channel) => channel.type),
      contentRequirements: campaign.contentPlan.requirements,
      publishingRequirements: campaign.publishingPlan.requirements,
      approvalRequired: true,
      executionReadiness: campaign.validation.executionReady ? "READY_FOR_REVIEW" : "NOT_READY",
      validation: campaign.validation,
    };
  }
}

export class MarketingWorkflowService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  public constructor(private readonly dependencies: MarketingServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
  }

  public async create(input: CreateMarketingWorkflowInput, tenant: TenantContext): Promise<MarketingWorkflow> {
    const timestamp = this.now().toISOString();
    const workflow: MarketingWorkflow = {
      id: `marketing-workflow:${this.idGenerator()}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      name: required(input.name, "name"),
      stages: input.stages === undefined ? WORKFLOW : this.validateStages(input.stages),
      currentStage: "Draft",
      approvalRequired: input.approvalRequired ?? true,
      executionEnabled: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.dependencies.repository.saveWorkflow(workflow);
  }

  public list(tenant: TenantContext): Promise<readonly MarketingWorkflow[]> {
    return this.dependencies.repository.listWorkflows({ tenantId: tenant.tenantId, storeId: tenant.storeId });
  }

  private validateStages(stages: readonly MarketingWorkflowStage[]): readonly MarketingWorkflowStage[] {
    const normalized = stages.filter((stage) => WORKFLOW.includes(stage));
    if (normalized.length === 0) {
      throw AppError.badRequest("Marketing workflow requires at least one supported stage.", { field: "stages" }, "MARKETING_WORKFLOW_INVALID");
    }
    return normalized;
  }
}

export class MarketingStrategyService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly audienceService = new AudienceService();

  public constructor(private readonly dependencies: MarketingServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
  }

  public async create(input: CreateMarketingStrategyInput, tenant: TenantContext): Promise<MarketingStrategy> {
    const timestamp = this.now().toISOString();
    const goal = goalFrom(input.goalType);
    const strategy: MarketingStrategy = {
      id: `marketing-strategy:${this.idGenerator()}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(input.campaignId === undefined ? {} : { campaignId: required(input.campaignId, "campaignId") }),
      name: required(input.name, "name"),
      goal,
      audience: this.audienceService.create({ audienceName: input.audienceName }, `marketing-audience:${this.idGenerator()}`),
      primaryChannel: channel(input.primaryChannel),
      secondaryChannels: uniqueChannels(input.secondaryChannels ?? []),
      positioning: optional(input.positioning) ?? `Deterministic ${goal.type.toLowerCase().replace(/_/gu, " ")} strategy.`,
      contentRequirements: contentRequirements(goal.type, input.primaryChannel),
      publishingRequirements: publishingRequirements(input.primaryChannel),
      approvalRequired: true,
      executionReadiness: "READY_FOR_REVIEW",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.dependencies.repository.saveStrategy(strategy);
  }

  public list(tenant: TenantContext): Promise<readonly MarketingStrategy[]> {
    return this.dependencies.repository.listStrategies({ tenantId: tenant.tenantId, storeId: tenant.storeId });
  }
}

export class MarketingCampaignService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly audienceService = new AudienceService();
  private readonly validationService = new CampaignValidationService();
  private readonly planningService = new CampaignPlanningService();
  private auditSequence = 0;

  public constructor(private readonly dependencies: MarketingServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
  }

  public async create(input: CreateMarketingCampaignInput, tenant: TenantContext): Promise<{ readonly campaign: MarketingCampaign; readonly plan: CampaignPlanningResult }> {
    const timestamp = this.now().toISOString();
    const audience = this.audienceService.create(input, `marketing-audience:${this.idGenerator()}`);
    const channels = campaignChannels(input.primaryChannel, input.secondaryChannels ?? []);
    const approvalId = await this.createApproval(tenant, input.name, input.requestedBy ?? "marketing-api");
    const base = {
      id: `marketing-campaign:${this.idGenerator()}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      name: required(input.name, "name"),
      status: "READY_FOR_REVIEW" as const,
      goal: goalFrom(input.goalType, input.goalDescription, input.targetMetric),
      audience,
      channels,
      publishingPlan: publishingPlan(input.primaryChannel),
      contentPlan: contentPlan(input.goalType, input.primaryChannel),
      schedule: schedule(input.startsAt, input.endsAt, input.timezone),
      budget: budget(input.budgetAmount, input.budgetCurrency),
      ...(approvalId === undefined ? {} : { approvalId }),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const validation = this.validationService.validate(base);
    const campaign: MarketingCampaign = { ...base, validation };
    const saved = await this.dependencies.repository.saveCampaign(campaign);
    const plan = this.planningService.plan(saved);
    await this.audit(tenant, "MARKETING_CAMPAIGN_CREATED", saved.id, "Marketing campaign created.", input.correlationId, {
      campaignId: saved.id,
      status: saved.status,
      goalType: saved.goal.type,
    });
    await this.audit(tenant, "MARKETING_PLAN_CREATED", saved.id, "Marketing plan created.", input.correlationId, {
      campaignId: saved.id,
      primaryChannel: plan.primaryChannel,
      executionReadiness: plan.executionReadiness,
    });
    await this.audit(tenant, "MARKETING_PLAN_VALIDATED", saved.id, "Marketing plan validated.", input.correlationId, {
      campaignId: saved.id,
      errorCount: saved.validation.errors.length,
      warningCount: saved.validation.warnings.length,
    });
    return { campaign: saved, plan };
  }

  public async list(query: MarketingCampaignListQuery, tenant: TenantContext) {
    return this.dependencies.repository.listCampaigns({
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...query,
    });
  }

  public async get(campaignId: string, tenant: TenantContext): Promise<MarketingCampaign> {
    const campaign = await this.dependencies.repository.findCampaignById(required(campaignId, "campaignId"));
    if (campaign?.tenantId !== tenant.tenantId || campaign.storeId !== tenant.storeId) {
      throw AppError.notFound("Marketing campaign was not found.", { campaignId }, "MARKETING_CAMPAIGN_NOT_FOUND");
    }
    return campaign;
  }

  private async createApproval(tenant: TenantContext, name: string, requestedBy: string): Promise<string | undefined> {
    if (this.dependencies.approvalRepository === undefined) {
      return undefined;
    }
    const approvalId = `approval:marketing:${this.idGenerator()}`;
    await this.dependencies.approvalRepository.save(tenant, {
      ...tenant,
      id: approvalId,
      proposalId: approvalId,
      title: `Review marketing campaign ${required(name, "name")}`,
      status: "pending",
      riskLevel: "LOW",
      requestedBy,
      createdAt: this.now().toISOString(),
      requestedAt: this.now().toISOString(),
      requiresHumanApproval: true,
      executionEnabled: false,
      source: "deterministic-preview",
      version: 1,
    });
    return approvalId;
  }

  private async audit(
    tenant: TenantContext,
    storefrontEventType: string,
    entityId: string,
    summary: string,
    correlationId: string | undefined,
    details: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    if (this.dependencies.auditRepository === undefined) {
      return;
    }
    this.auditSequence += 1;
    await this.dependencies.auditRepository.append(tenant, {
      ...tenant,
      id: `audit:${entityId}:marketing:${this.auditSequence}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "marketing-intelligence-foundation",
      occurredAt: this.now().toISOString(),
      summary,
      details: { ...details, storefrontEventType, activeSprint: "SACP-04.01" },
      source: "deterministic-preview",
      sequence: this.auditSequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "marketing.foundation",
      status: "READY_FOR_REVIEW",
      recordedAt: this.now().toISOString(),
    });
  }
}

function goalFrom(type: MarketingGoalType, description?: string, targetMetric?: string): MarketingGoal {
  if (!GOALS.has(type)) {
    throw AppError.badRequest("Marketing goal type is invalid.", { field: "goalType" }, "MARKETING_GOAL_INVALID");
  }
  return {
    type,
    description: optional(description) ?? `${type.toLowerCase().replace(/_/gu, " ")} campaign goal.`,
    targetMetric: optional(targetMetric) ?? defaultMetric(type),
  };
}

function defaultMetric(type: MarketingGoalType): string {
  const metrics: Record<MarketingGoalType, string> = {
    BRAND_AWARENESS: "reach",
    TRAFFIC: "sessions",
    ENGAGEMENT: "engagement_rate",
    LEAD_GENERATION: "leads",
    SALES: "conversion_rate",
    RETENTION: "repeat_purchase_rate",
    UPSELL: "average_order_value",
    CROSS_SELL: "attach_rate",
  };
  return metrics[type];
}

function campaignChannels(primary: MarketingChannelType, secondary: readonly MarketingChannelType[]): readonly MarketingChannel[] {
  const primaryType = channel(primary);
  return [
    { type: primaryType, priority: "PRIMARY", enabled: true },
    ...uniqueChannels(secondary).filter((item) => item !== primaryType).map((type): MarketingChannel => ({ type, priority: "SECONDARY", enabled: true })),
  ];
}

function channel(value: MarketingChannelType): MarketingChannelType {
  if (!CHANNELS.has(value)) {
    throw AppError.badRequest("Marketing channel is invalid.", { field: "channel" }, "MARKETING_CHANNEL_INVALID");
  }
  return value;
}

function contentPlan(goalType: MarketingGoalType, primaryChannel: MarketingChannelType): ContentPlan {
  return {
    requirements: contentRequirements(goalType, primaryChannel),
    contentTypes: primaryChannel === "BLOG" ? ["outline", "seo-brief"] : ["creative-brief", "caption-brief"],
    copyGenerationAllowed: false,
  };
}

function publishingPlan(primaryChannel: MarketingChannelType): PublishingPlan {
  return {
    requirements: publishingRequirements(primaryChannel),
    publishingAllowed: false,
    schedulingExecutionAllowed: false,
  };
}

function contentRequirements(goalType: MarketingGoalType, primaryChannel: MarketingChannelType): readonly string[] {
  return [
    `Prepare ${goalType.toLowerCase().replace(/_/gu, " ")} message brief.`,
    `Define ${primaryChannel.toLowerCase()} content format requirements.`,
    "Keep copy generation disabled until a later approved sprint.",
  ];
}

function publishingRequirements(primaryChannel: MarketingChannelType): readonly string[] {
  return [
    `Prepare ${primaryChannel.toLowerCase()} publishing checklist.`,
    "Require human approval before scheduling.",
    "Keep publishing execution disabled.",
  ];
}

function schedule(startsAt: string, endsAt: string, timezone?: string): CampaignSchedule {
  return {
    startsAt: required(startsAt, "startsAt"),
    endsAt: required(endsAt, "endsAt"),
    timezone: optional(timezone) ?? "UTC",
  };
}

function budget(amount: number, currency: string): CampaignBudget {
  return {
    amount,
    currency: required(currency, "budgetCurrency").toUpperCase(),
    allocationNotes: ["Budget is recorded for planning only; no ad spend execution is enabled."],
  };
}

function uniqueChannels(values: readonly MarketingChannelType[]): readonly MarketingChannelType[] {
  return [...new Set(values.map((value) => channel(value)))];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => required(value, "listItem")))];
}

function required(value: string | undefined, field: string): string {
  const text = optional(value);
  if (text === undefined) {
    throw AppError.badRequest("Required text field is missing.", { field }, "MARKETING_REQUIRED_FIELD_MISSING");
  }
  return text;
}

function optional(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text === undefined || text.length === 0 ? undefined : text;
}

function issue(code: string, message: string, path: string, severity: "ERROR" | "WARNING" = "ERROR"): CampaignValidationIssue {
  return { code, message, severity, path };
}

