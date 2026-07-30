import { randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { TenantContext } from "../../../saie/application/index.js";
import type {
  CampaignValidationIssue,
  MarketingAudience,
  MarketingChannelType,
  MarketingContentListQuery,
  MarketingContentType,
  MarketingContentValidationReport,
  MarketingContentVariant,
  MarketingContentWorkflowState,
  MarketingGeneratedContent,
  MarketingGoalType,
  MarketingRepository,
  MarketingContentSection,
} from "../../domain/index.js";
import type { MarketingApprovalRepository, MarketingAuditRepository } from "./marketing-services.js";

export interface CreateMarketingContentInput {
  readonly campaignId?: string;
  readonly strategyId?: string;
  readonly name: string;
  readonly brandName: string;
  readonly productName: string;
  readonly audienceName: string;
  readonly audienceSegments?: readonly string[];
  readonly goalType: MarketingGoalType;
  readonly channel: MarketingChannelType;
  readonly variant?: MarketingContentVariant;
  readonly contentTypes: readonly MarketingContentType[];
  readonly benefits?: readonly string[];
  readonly features?: readonly string[];
  readonly keywords?: readonly string[];
  readonly callToAction?: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface ValidateMarketingContentInput {
  readonly contentId?: string;
  readonly content?: CreateMarketingContentInput;
}

export interface ReviewMarketingContentInput {
  readonly contentId: string;
  readonly decision?: "APPROVED" | "REJECTED";
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface MarketingContentServiceDependencies {
  readonly repository: MarketingRepository;
  readonly approvalRepository?: MarketingApprovalRepository;
  readonly auditRepository?: MarketingAuditRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

const CHANNELS: readonly MarketingChannelType[] = ["SHOPIFY", "EMAIL", "FACEBOOK", "INSTAGRAM", "TIKTOK", "THREADS", "PINTEREST", "BLOG"];
const GOALS: readonly MarketingGoalType[] = ["BRAND_AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEAD_GENERATION", "SALES", "RETENTION", "UPSELL", "CROSS_SELL"];
const CONTENT_TYPES: readonly MarketingContentType[] = [
  "PRODUCT_DESCRIPTION",
  "SHORT_DESCRIPTION",
  "HEADLINE",
  "HOOK",
  "CALL_TO_ACTION",
  "BENEFITS",
  "FEATURES",
  "FAQ",
  "EMAIL_SUBJECT",
  "EMAIL_BODY",
  "BLOG_OUTLINE",
  "META_TITLE",
  "META_DESCRIPTION",
  "KEYWORDS",
  "SOCIAL_CAPTION",
  "HASHTAGS",
];

export class ContentPlanner {
  public plan(input: CreateMarketingContentInput): readonly MarketingContentType[] {
    const requested = uniqueContentTypes(input.contentTypes);
    const required = this.requiredForChannel(input.channel);
    return uniqueContentTypes([...requested, ...required]);
  }

  private requiredForChannel(channel: MarketingChannelType): readonly MarketingContentType[] {
    switch (channel) {
      case "EMAIL":
        return ["EMAIL_SUBJECT", "EMAIL_BODY", "CALL_TO_ACTION"];
      case "BLOG":
        return ["BLOG_OUTLINE", "META_TITLE", "META_DESCRIPTION", "KEYWORDS"];
      case "SHOPIFY":
        return ["PRODUCT_DESCRIPTION", "SHORT_DESCRIPTION", "BENEFITS", "FEATURES", "CALL_TO_ACTION"];
      case "FACEBOOK":
      case "INSTAGRAM":
      case "TIKTOK":
      case "THREADS":
      case "PINTEREST":
        return ["HOOK", "SOCIAL_CAPTION", "HASHTAGS", "CALL_TO_ACTION"];
    }
  }
}

export class ContentTemplateService {
  public render(input: CreateMarketingContentInput, type: MarketingContentType): string {
    const benefit = first(input.benefits, "a more confident daily routine");
    const feature = first(input.features, "thoughtful product design");
    const cta = optional(input.callToAction) ?? "Explore the collection";
    const keywordText = unique(input.keywords ?? [input.productName, input.brandName]).join(", ");
    switch (type) {
      case "PRODUCT_DESCRIPTION":
        return `${input.productName} by ${input.brandName} helps ${input.audienceName.toLowerCase()} enjoy ${benefit.toLowerCase()} with ${feature.toLowerCase()}. ${cta}.`;
      case "SHORT_DESCRIPTION":
        return `${input.productName}: ${benefit} for ${input.audienceName.toLowerCase()}.`;
      case "HEADLINE":
        return `${input.productName} for ${input.audienceName}`;
      case "HOOK":
        return `Meet ${input.productName}, a simple way to support ${benefit.toLowerCase()}.`;
      case "CALL_TO_ACTION":
        return cta;
      case "BENEFITS":
        return unique(input.benefits ?? [benefit]).join("; ");
      case "FEATURES":
        return unique(input.features ?? [feature]).join("; ");
      case "FAQ":
        return `Q: Who is ${input.productName} for? A: ${input.audienceName}. Q: What is the main benefit? A: ${benefit}.`;
      case "EMAIL_SUBJECT":
        return `${input.productName}: ${benefit}`;
      case "EMAIL_BODY":
        return `${input.audienceName}, discover ${input.productName} from ${input.brandName}. It focuses on ${benefit.toLowerCase()} and ${feature.toLowerCase()}. ${cta}.`;
      case "BLOG_OUTLINE":
        return `1. Introduce ${input.productName}. 2. Explain ${benefit}. 3. Highlight ${feature}. 4. Close with ${cta}.`;
      case "META_TITLE":
        return `${input.productName} | ${input.brandName}`;
      case "META_DESCRIPTION":
        return `${input.productName} helps ${input.audienceName.toLowerCase()} with ${benefit.toLowerCase()} from ${input.brandName}.`;
      case "KEYWORDS":
        return keywordText;
      case "SOCIAL_CAPTION":
        return `${input.productName} brings ${benefit.toLowerCase()} into a clean ${input.brandName} routine. ${cta}.`;
      case "HASHTAGS":
        return unique(input.keywords ?? [input.productName, input.brandName]).map((keyword) => `#${keyword.replace(/[^a-z0-9]/giu, "")}`).join(" ");
    }
  }
}

export class ContentVariantGenerator {
  public apply(value: string, variant: MarketingContentVariant): string {
    switch (variant) {
      case "SHORT":
      case "MINIMAL":
        return sentenceLimit(value, 1);
      case "MEDIUM":
        return sentenceLimit(value, 2);
      case "LONG":
        return `${value} Designed for consistent planning, this draft remains ready for human review before publishing.`;
      case "PROFESSIONAL":
        return `Professional: ${value}`;
      case "FRIENDLY":
        return `Friendly note: ${value}`;
      case "LUXURY":
        return `Premium edit: ${value}`;
    }
  }
}

export class ContentFormatter {
  public format(type: MarketingContentType, value: string): string {
    const normalized = value.replace(/\s+/gu, " ").trim();
    if (type === "META_TITLE") {
      return truncate(normalized, 60);
    }
    if (type === "META_DESCRIPTION") {
      return truncate(normalized, 155);
    }
    return normalized;
  }
}

export class ContentAssembler {
  public assemble(input: {
    readonly contentId: string;
    readonly source: CreateMarketingContentInput;
    readonly plannedTypes: readonly MarketingContentType[];
  }): readonly MarketingContentSection[] {
    const template = new ContentTemplateService();
    const variants = new ContentVariantGenerator();
    const formatter = new ContentFormatter();
    const variant = input.source.variant ?? "MEDIUM";
    return input.plannedTypes.map((type) => {
      const body = formatter.format(type, variants.apply(template.render(input.source, type), variant));
      return {
        type,
        title: titleFor(type),
        body,
        keywords: unique(input.source.keywords ?? [input.source.productName, input.source.brandName]).slice(0, 8),
      };
    }).map((section, index) => ({ ...section, title: `${index + 1}. ${section.title}` }));
  }
}

export class ContentValidator {
  public validate(input: {
    readonly content: Pick<MarketingGeneratedContent, "channel" | "goalType" | "contentTypes" | "sections" | "approvalId">;
  }): MarketingContentValidationReport {
    const errors: CampaignValidationIssue[] = [];
    const warnings: CampaignValidationIssue[] = [];
    if (!CHANNELS.includes(input.content.channel)) {
      errors.push(issue("CONTENT_CHANNEL_INVALID", "Content channel is unsupported.", "content.channel"));
    }
    if (!GOALS.includes(input.content.goalType)) {
      errors.push(issue("CONTENT_GOAL_INVALID", "Marketing goal is unsupported for content generation.", "content.goalType"));
    }
    if (input.content.contentTypes.length === 0 || input.content.sections.length === 0) {
      errors.push(issue("CONTENT_REQUIRED_FIELDS_MISSING", "At least one content type and section is required.", "content.sections"));
    }
    const duplicates = duplicateTypes(input.content.sections.map((section) => section.type));
    if (duplicates.length > 0) {
      errors.push(issue("CONTENT_DUPLICATE_SECTIONS", `Duplicate content sections: ${duplicates.join(", ")}.`, "content.sections"));
    }
    for (const section of input.content.sections) {
      if (section.body.length === 0 || section.body.length > maxLength(section.type)) {
        errors.push(issue("CONTENT_LENGTH_INVALID", `${section.type} length is invalid.`, `content.sections.${section.type}`));
      }
      if (section.keywords.length === 0 && (section.type === "KEYWORDS" || section.type === "META_DESCRIPTION" || section.type === "BLOG_OUTLINE")) {
        errors.push(issue("CONTENT_KEYWORDS_MISSING", "Keywords are required for SEO-oriented content.", `content.sections.${section.type}`));
      }
    }
    if (!input.content.sections.some((section) => section.type === "CALL_TO_ACTION")) {
      warnings.push(issue("CONTENT_CTA_MISSING", "Call to action is recommended before review.", "content.sections", "WARNING"));
    }
    if (!compatibleContent(input.content.channel, input.content.contentTypes)) {
      errors.push(issue("CONTENT_CHANNEL_COMPATIBILITY_FAILED", "One or more content types are not compatible with the selected channel.", "content.channel"));
    }
    if (!compatibleGoal(input.content.goalType, input.content.contentTypes)) {
      warnings.push(issue("CONTENT_GOAL_COMPATIBILITY_WARNING", "Content mix may not fully support the selected marketing goal.", "content.goalType", "WARNING"));
    }
    return {
      errors,
      warnings,
      approvalRequired: true,
      readyForReview: errors.length === 0 && input.content.approvalId !== undefined,
    };
  }
}

export class ContentGenerationService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly planner = new ContentPlanner();
  private readonly assembler = new ContentAssembler();
  private readonly validator = new ContentValidator();
  private auditSequence = 0;

  public constructor(private readonly dependencies: MarketingContentServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
  }

  public async generate(input: CreateMarketingContentInput, tenant: TenantContext): Promise<MarketingGeneratedContent> {
    const timestamp = this.timestamp();
    const approvalId = await this.createApproval(tenant, input.name, input.requestedBy ?? "marketing-api");
    const plannedTypes = this.planner.plan(input);
    const base = {
      id: `marketing-content:${this.idGenerator()}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(input.campaignId === undefined ? {} : { campaignId: required(input.campaignId, "campaignId") }),
      ...(input.strategyId === undefined ? {} : { strategyId: required(input.strategyId, "strategyId") }),
      name: required(input.name, "name"),
      channel: channel(input.channel),
      goalType: goal(input.goalType),
      audience: audience(input, `marketing-audience:${this.idGenerator()}`),
      variant: input.variant ?? "MEDIUM",
      contentTypes: plannedTypes,
      sections: [] as readonly MarketingContentSection[],
      workflowState: "Generate" as const,
      ...(approvalId === undefined ? {} : { approvalId }),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const sections = this.assembler.assemble({ contentId: base.id, source: input, plannedTypes });
    const validation = this.validator.validate({ content: { ...base, sections } });
    const content: MarketingGeneratedContent = {
      ...base,
      sections,
      workflowState: validation.readyForReview ? "Review" : "Draft",
      validation,
    };
    const saved = await this.dependencies.repository.saveContent(content);
    await this.audit(tenant, "CONTENT_GENERATED", saved.id, "Marketing content generated deterministically.", input.correlationId, {
      contentId: saved.id,
      channel: saved.channel,
      sectionCount: saved.sections.length,
    });
    await this.audit(tenant, "CONTENT_VALIDATED", saved.id, "Marketing content validated.", input.correlationId, {
      contentId: saved.id,
      errorCount: saved.validation.errors.length,
      warningCount: saved.validation.warnings.length,
    });
    return saved;
  }

  public async list(query: MarketingContentListQuery, tenant: TenantContext) {
    return this.dependencies.repository.listContent({ tenantId: tenant.tenantId, storeId: tenant.storeId, ...query });
  }

  public async get(contentId: string, tenant: TenantContext): Promise<MarketingGeneratedContent> {
    const content = await this.dependencies.repository.findContentById(required(contentId, "contentId"));
    if (content?.tenantId !== tenant.tenantId || content.storeId !== tenant.storeId) {
      throw AppError.notFound("Marketing content was not found.", { contentId }, "MARKETING_CONTENT_NOT_FOUND");
    }
    return content;
  }

  public async validate(input: ValidateMarketingContentInput, tenant: TenantContext): Promise<MarketingContentValidationReport> {
    if (input.contentId !== undefined) {
      const existing = await this.get(input.contentId, tenant);
      return this.validator.validate({ content: existing });
    }
    if (input.content === undefined) {
      throw AppError.badRequest("Validation requires a contentId or content payload.", { field: "content" }, "MARKETING_CONTENT_VALIDATION_INPUT_REQUIRED");
    }
    const plannedTypes = this.planner.plan(input.content);
    const sections = this.assembler.assemble({ contentId: "preview", source: input.content, plannedTypes });
    return this.validator.validate({
      content: {
        channel: input.content.channel,
        goalType: input.content.goalType,
        contentTypes: plannedTypes,
        sections,
        approvalId: "preview-approval",
      },
    });
  }

  private async createApproval(tenant: TenantContext, name: string, requestedBy: string): Promise<string | undefined> {
    if (this.dependencies.approvalRepository === undefined) {
      return undefined;
    }
    const approvalId = `approval:marketing-content:${this.idGenerator()}`;
    await this.dependencies.approvalRepository.save(tenant, {
      ...tenant,
      id: approvalId,
      proposalId: approvalId,
      title: `Review generated marketing content ${required(name, "name")}`,
      status: "pending",
      riskLevel: "LOW",
      requestedBy,
      createdAt: this.timestamp(),
      requestedAt: this.timestamp(),
      requiresHumanApproval: true,
      executionEnabled: false,
      source: "deterministic-preview",
      version: 1,
    });
    return approvalId;
  }

  private async audit(
    tenant: TenantContext,
    eventType: string,
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
      id: `audit:${entityId}:content:${this.auditSequence}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "marketing-content-generation",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, marketingEventType: eventType, activeSprint: "SACP-04.02" },
      source: "deterministic-preview",
      sequence: this.auditSequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "marketing.content-generation",
      status: "READY_FOR_REVIEW",
      recordedAt: this.timestamp(),
    });
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

export class ContentReviewService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private auditSequence = 0;

  public constructor(private readonly dependencies: MarketingContentServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
  }

  public async review(input: ReviewMarketingContentInput, tenant: TenantContext): Promise<MarketingGeneratedContent> {
    const content = await this.get(input.contentId, tenant);
    const workflowState: MarketingContentWorkflowState = input.decision === "APPROVED" ? "Ready For Publishing" : input.decision === "REJECTED" ? "Draft" : "Review";
    const updated = await this.dependencies.repository.saveContent({
      ...content,
      workflowState,
      updatedAt: this.now().toISOString(),
    });
    await this.audit(tenant, this.event(input.decision), updated.id, input.correlationId);
    return updated;
  }

  private async get(contentId: string, tenant: TenantContext): Promise<MarketingGeneratedContent> {
    const content = await this.dependencies.repository.findContentById(required(contentId, "contentId"));
    if (content?.tenantId !== tenant.tenantId || content.storeId !== tenant.storeId) {
      throw AppError.notFound("Marketing content was not found.", { contentId }, "MARKETING_CONTENT_NOT_FOUND");
    }
    return content;
  }

  private event(decision: ReviewMarketingContentInput["decision"]): string {
    if (decision === "APPROVED") {
      return "CONTENT_APPROVED";
    }
    if (decision === "REJECTED") {
      return "CONTENT_REJECTED";
    }
    return "CONTENT_UPDATED";
  }

  private async audit(tenant: TenantContext, eventType: string, entityId: string, correlationId: string | undefined): Promise<void> {
    if (this.dependencies.auditRepository === undefined) {
      return;
    }
    this.auditSequence += 1;
    await this.dependencies.auditRepository.append(tenant, {
      ...tenant,
      id: `audit:${entityId}:content-review:${this.auditSequence}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "marketing-content-review",
      occurredAt: this.now().toISOString(),
      summary: "Marketing content review state updated.",
      details: { marketingEventType: eventType, contentId: entityId, activeSprint: "SACP-04.02" },
      source: "deterministic-preview",
      sequence: this.auditSequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "marketing.content-review",
      status: eventType === "CONTENT_REJECTED" ? "NEEDS_INPUT" : "READY_FOR_REVIEW",
      recordedAt: this.now().toISOString(),
    });
  }
}

function compatibleContent(channelValue: MarketingChannelType, types: readonly MarketingContentType[]): boolean {
  const allowed: Record<MarketingChannelType, readonly MarketingContentType[]> = {
    SHOPIFY: ["PRODUCT_DESCRIPTION", "SHORT_DESCRIPTION", "HEADLINE", "CALL_TO_ACTION", "BENEFITS", "FEATURES", "FAQ", "META_TITLE", "META_DESCRIPTION", "KEYWORDS"],
    EMAIL: ["EMAIL_SUBJECT", "EMAIL_BODY", "HEADLINE", "HOOK", "CALL_TO_ACTION", "BENEFITS", "KEYWORDS"],
    FACEBOOK: ["HEADLINE", "HOOK", "CALL_TO_ACTION", "BENEFITS", "SOCIAL_CAPTION", "HASHTAGS"],
    INSTAGRAM: ["HEADLINE", "HOOK", "CALL_TO_ACTION", "BENEFITS", "SOCIAL_CAPTION", "HASHTAGS"],
    TIKTOK: ["HOOK", "CALL_TO_ACTION", "BENEFITS", "SOCIAL_CAPTION", "HASHTAGS"],
    THREADS: ["HOOK", "CALL_TO_ACTION", "SOCIAL_CAPTION", "HASHTAGS"],
    PINTEREST: ["HEADLINE", "HOOK", "CALL_TO_ACTION", "SOCIAL_CAPTION", "HASHTAGS", "KEYWORDS"],
    BLOG: ["HEADLINE", "HOOK", "CALL_TO_ACTION", "BLOG_OUTLINE", "META_TITLE", "META_DESCRIPTION", "KEYWORDS", "FAQ"],
  };
  return types.every((type) => allowed[channelValue].includes(type));
}

function compatibleGoal(goalType: MarketingGoalType, types: readonly MarketingContentType[]): boolean {
  if (goalType === "SALES" || goalType === "UPSELL" || goalType === "CROSS_SELL") {
    return types.includes("CALL_TO_ACTION") || types.includes("PRODUCT_DESCRIPTION");
  }
  if (goalType === "TRAFFIC") {
    return types.includes("META_TITLE") || types.includes("SOCIAL_CAPTION") || types.includes("EMAIL_BODY");
  }
  return true;
}

function maxLength(type: MarketingContentType): number {
  if (type === "META_TITLE" || type === "EMAIL_SUBJECT" || type === "HEADLINE") {
    return 80;
  }
  if (type === "META_DESCRIPTION" || type === "HOOK" || type === "CALL_TO_ACTION") {
    return 180;
  }
  return 1200;
}

function duplicateTypes(types: readonly MarketingContentType[]): readonly MarketingContentType[] {
  const seen = new Set<MarketingContentType>();
  const duplicates = new Set<MarketingContentType>();
  for (const type of types) {
    if (seen.has(type)) {
      duplicates.add(type);
    }
    seen.add(type);
  }
  return [...duplicates];
}

function audience(input: CreateMarketingContentInput, id: string): MarketingAudience {
  return {
    id,
    name: required(input.audienceName, "audienceName"),
    description: `${input.audienceName} audience for deterministic content generation.`,
    segments: unique(input.audienceSegments ?? [input.audienceName]),
    markets: ["US"],
  };
}

function channel(value: MarketingChannelType): MarketingChannelType {
  if (!CHANNELS.includes(value)) {
    throw AppError.badRequest("Marketing content channel is invalid.", { field: "channel" }, "MARKETING_CONTENT_CHANNEL_INVALID");
  }
  return value;
}

function goal(value: MarketingGoalType): MarketingGoalType {
  if (!GOALS.includes(value)) {
    throw AppError.badRequest("Marketing content goal is invalid.", { field: "goalType" }, "MARKETING_CONTENT_GOAL_INVALID");
  }
  return value;
}

function uniqueContentTypes(values: readonly MarketingContentType[]): readonly MarketingContentType[] {
  return [...new Set(values.map((value) => {
    if (!CONTENT_TYPES.includes(value)) {
      throw AppError.badRequest("Marketing content type is invalid.", { field: "contentTypes" }, "MARKETING_CONTENT_TYPE_INVALID");
    }
    return value;
  }))];
}

function titleFor(type: MarketingContentType): string {
  return type.toLowerCase().replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1).trimEnd();
}

function sentenceLimit(value: string, maxSentences: number): string {
  const sentences = value.split(/(?<=\.)\s+/u).filter((sentence) => sentence.trim().length > 0);
  return (sentences.length === 0 ? [value] : sentences).slice(0, maxSentences).join(" ").trim();
}

function first(values: readonly string[] | undefined, fallback: string): string {
  return optional(values?.[0]) ?? fallback;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => required(value, "listItem")))];
}

function required(value: string | undefined, field: string): string {
  const text = optional(value);
  if (text === undefined) {
    throw AppError.badRequest("Required text field is missing.", { field }, "MARKETING_CONTENT_REQUIRED_FIELD_MISSING");
  }
  return text;
}

function optional(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text === undefined || text.length === 0 ? undefined : text;
}

function issue(code: string, message: string, path: string, severity: "ERROR" | "WARNING" = "ERROR"): CampaignValidationIssue {
  return { code, message, path, severity };
}
