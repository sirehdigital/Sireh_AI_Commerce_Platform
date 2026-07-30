import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type {
  StorefrontExecutionMode,
  StorefrontProfile,
  StorefrontProject,
  StorefrontProjectListQuery,
  StorefrontProjectListResult,
  StorefrontProjectStatus,
  StorefrontThemeTarget,
} from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface StorefrontFoundationApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface StorefrontFoundationAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface CreateStorefrontProfileInput {
  readonly brandName: string;
  readonly brandPositioning: string;
  readonly targetMarkets: readonly string[];
  readonly defaultLocale: string;
  readonly supportedLocales?: readonly string[];
  readonly currency: string;
  readonly industry: string;
  readonly visualIdentity?: readonly string[];
  readonly preferredColorPalette?: readonly string[];
  readonly typographyDirection?: string;
  readonly toneOfVoice?: readonly string[];
  readonly photographyDirection?: string;
  readonly trustStyle?: readonly string[];
  readonly targetCustomer?: readonly string[];
  readonly merchandisingPriorities?: readonly string[];
  readonly navigationPreferences?: readonly string[];
  readonly homepagePriorities?: readonly string[];
  readonly productPagePriorities?: readonly string[];
  readonly footerRequirements?: readonly string[];
  readonly policyPageReferences?: StorefrontProfile["policyPageReferences"];
  readonly socialLinks?: StorefrontProfile["socialLinks"];
  readonly contactReferences?: StorefrontProfile["contactReferences"];
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface CreateStorefrontFoundationProjectInput {
  readonly profileId: string;
  readonly selectedProductDraftIds?: readonly string[];
  readonly locale?: string;
  readonly markets?: readonly string[];
  readonly mode?: StorefrontExecutionMode;
  readonly themeTarget?: StorefrontThemeTarget;
  readonly themeTargetReference?: string;
  readonly requestedBy?: string;
  readonly force?: boolean;
  readonly correlationId?: string;
}

export interface TransitionStorefrontProjectInput {
  readonly projectId: string;
  readonly status: StorefrontProjectStatus;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly correlationId?: string;
}

export interface StorefrontFoundationServiceDependencies {
  readonly repository: StorefrontRepository;
  readonly approvalRepository?: StorefrontFoundationApprovalRepository;
  readonly auditRepository?: StorefrontFoundationAuditRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

const FOUNDATION_STATUSES = new Set<StorefrontProjectStatus>([
  "DRAFT",
  "PLANNING",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "READY_FOR_DEPLOYMENT",
  "READY_FOR_RELEASE",
  "FAILED",
  "CANCELLED",
]);

const ALLOWED_TRANSITIONS: Readonly<Record<StorefrontProjectStatus, readonly StorefrontProjectStatus[]>> = {
  DRAFT: ["PLANNING", "CANCELLED"],
  PLANNING: ["PENDING_REVIEW", "FAILED", "CANCELLED"],
  PLANNED: [],
  VALIDATING: [],
  VALIDATION_FAILED: [],
  PREVIEW_READY: [],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "FAILED", "CANCELLED"],
  APPROVED: ["READY_FOR_DEPLOYMENT"],
  REJECTED: ["PLANNING", "CANCELLED"],
  READY_FOR_DEPLOYMENT: [],
  READY_FOR_RELEASE: [],
  DEPLOYING: [],
  DEPLOYED: [],
  FAILED: [],
  CANCELLED: [],
};

export class StorefrontFoundationService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private auditSequence = 0;

  public constructor(private readonly dependencies: StorefrontFoundationServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
  }

  public async createProfile(input: CreateStorefrontProfileInput, tenant: TenantContext): Promise<StorefrontProfile> {
    const timestamp = this.timestamp();
    const brandName = this.requiredText(input.brandName, "brandName");
    const profile: StorefrontProfile = {
      id: `storefront-profile:${this.idGenerator()}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      version: 1,
      brandName,
      brandPositioning: this.requiredText(input.brandPositioning, "brandPositioning"),
      targetMarkets: this.requireStringList(input.targetMarkets, "targetMarkets"),
      defaultLocale: this.requiredText(input.defaultLocale, "defaultLocale"),
      supportedLocales: input.supportedLocales === undefined ? [this.requiredText(input.defaultLocale, "defaultLocale")] : this.requireStringList(input.supportedLocales, "supportedLocales"),
      currency: this.requiredText(input.currency, "currency").toUpperCase(),
      industry: this.requiredText(input.industry, "industry"),
      visualIdentity: this.optionalStringList(input.visualIdentity, ["premium", "trustworthy"]),
      preferredColorPalette: this.optionalStringList(input.preferredColorPalette, ["#111111", "#FFFFFF"]),
      typographyDirection: this.optionalText(input.typographyDirection) ?? "Premium mobile-first hierarchy",
      toneOfVoice: this.optionalStringList(input.toneOfVoice, ["clear", "elegant"]),
      photographyDirection: this.optionalText(input.photographyDirection) ?? "Product-first imagery reserved for merchant review",
      trustStyle: this.optionalStringList(input.trustStyle, ["secure checkout", "clear policies"]),
      targetCustomer: this.optionalStringList(input.targetCustomer, ["online shoppers"]),
      merchandisingPriorities: this.optionalStringList(input.merchandisingPriorities, ["best sellers", "categories"]),
      navigationPreferences: this.optionalStringList(input.navigationPreferences, ["Shop", "About", "FAQ", "Contact"]),
      homepagePriorities: this.optionalStringList(input.homepagePriorities, ["hero", "featured collection", "newsletter"]),
      productPagePriorities: this.optionalStringList(input.productPagePriorities, ["gallery", "add to cart", "benefits", "shipping"]),
      footerRequirements: this.optionalStringList(input.footerRequirements, ["Company", "Customer Care", "Shop", "Newsletter"]),
      policyPageReferences: input.policyPageReferences ?? [],
      socialLinks: input.socialLinks ?? [],
      contactReferences: input.contactReferences ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = await this.dependencies.repository.saveProfile(profile);
    await this.audit(tenant, "storefront.profile.created", saved.id, "Storefront profile created for planning.", input.correlationId, {
      profileId: saved.id,
      brandName: saved.brandName,
    });
    return saved;
  }

  public listProfiles(tenant: TenantContext): Promise<{ readonly items: readonly StorefrontProfile[]; readonly total: number; readonly limit: number; readonly offset: number; readonly hasNextPage: boolean; readonly nextOffset?: number }> {
    return this.dependencies.repository.listProfiles({ tenantId: tenant.tenantId, storeId: tenant.storeId });
  }

  public async createProject(input: CreateStorefrontFoundationProjectInput, tenant: TenantContext): Promise<StorefrontProject> {
    const profileId = this.requiredText(input.profileId, "profileId");
    const profile = await this.dependencies.repository.findProfile({ tenantId: tenant.tenantId, storeId: tenant.storeId, profileId });
    if (profile === undefined) {
      throw AppError.notFound("Storefront profile was not found.", { profileId }, "STOREFRONT_PROFILE_NOT_FOUND");
    }

    const mode = input.mode ?? "PLAN_ONLY";
    if (mode !== "PLAN_ONLY") {
      throw AppError.badRequest("SACP-03.03A supports PLAN_ONLY execution only.", { mode }, "STOREFRONT_MODE_NOT_ACTIVE");
    }

    const selectedProductDraftIds = this.optionalStringList(input.selectedProductDraftIds, []);
    const locale = this.optionalText(input.locale) ?? profile.defaultLocale;
    const markets = input.markets === undefined ? profile.targetMarkets : this.requireStringList(input.markets, "markets");
    const themeTargetReference = this.optionalText(input.themeTargetReference) ?? this.optionalText(input.themeTarget?.reference);
    const idempotencyKey = this.idempotencyKey({
      tenant,
      profileId: profile.id,
      profileVersion: profile.version,
      selectedProductDraftIds,
      locale,
      markets,
      mode,
      themeTargetReference: themeTargetReference ?? "none",
    });
    const existing = await this.dependencies.repository.findProjectByIdempotencyKey({ tenantId: tenant.tenantId, storeId: tenant.storeId, idempotencyKey });
    if (existing !== undefined && input.force !== true) {
      await this.audit(tenant, "storefront.project.replayed", existing.id, "Storefront project replayed through idempotency.", input.correlationId, {
        projectId: existing.id,
        idempotencyKey,
      });
      return existing;
    }

    const timestamp = this.timestamp();
    const projectId = `storefront-project:${this.idGenerator()}`;
    const approvalId = await this.createApproval(tenant, projectId, profile.brandName, this.optionalText(input.requestedBy) ?? "storefront-api");
    const project: StorefrontProject = {
      id: projectId,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      status: "PENDING_REVIEW",
      mode,
      brandName: profile.brandName,
      themeTargetReference: themeTargetReference ?? "PLAN_ONLY",
      selectedProductDraftIds,
      locale,
      markets,
      idempotencyKey,
      planSnapshot: this.foundationSnapshot(profile, selectedProductDraftIds) as unknown as StorefrontProject["planSnapshot"],
      validationSnapshot: {
        errors: [],
        warnings: [],
        blockedReasons: [],
        requiresHumanReview: true,
      },
      qualitySnapshot: {
        overallScore: 0,
        categoryScores: {},
        errors: [],
        warnings: ["Rendered storefront quality is not assessed in SACP-03.03A."],
        recommendations: ["Continue with later storefront planning sprints before theme artifact generation."],
        requiresHumanReview: true,
        renderedVisualQuality: "UNKNOWN",
      },
      ...(approvalId === undefined ? {} : { approvalId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(existing?.id === undefined || input.force !== true ? {} : { parentProjectId: existing.id }),
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
    };
    const saved = await this.dependencies.repository.createProject(project);
    await this.audit(tenant, "storefront.project.pending_review", saved.id, "Storefront foundation project created in PLAN_ONLY mode.", input.correlationId, {
      projectId: saved.id,
      approvalId: saved.approvalId ?? null,
      mode,
    });
    return saved;
  }

  public async transitionProject(input: TransitionStorefrontProjectInput, tenant: TenantContext): Promise<StorefrontProject> {
    const project = await this.getProject(input.projectId, tenant);
    const nextStatus = input.status;
    if (!FOUNDATION_STATUSES.has(nextStatus)) {
      throw AppError.badRequest("Storefront project status is not active in SACP-03.03A.", { status: nextStatus }, "STOREFRONT_STATUS_NOT_ACTIVE");
    }
    if (!ALLOWED_TRANSITIONS[project.status].includes(nextStatus)) {
      throw AppError.conflict("Storefront project status transition is invalid.", { from: project.status, to: nextStatus }, "STOREFRONT_STATUS_TRANSITION_INVALID");
    }
    const timestamp = this.timestamp();
    const updated: StorefrontProject = {
      ...project,
      status: nextStatus,
      updatedAt: timestamp,
      ...(nextStatus === "FAILED" ? { failureCode: this.optionalText(input.failureCode) ?? "STOREFRONT_PROJECT_FAILED", failureMessage: this.optionalText(input.failureMessage) ?? "Storefront project failed." } : {}),
      ...(["READY_FOR_DEPLOYMENT", "FAILED", "CANCELLED"].includes(nextStatus) ? { completedAt: timestamp } : {}),
    };
    const saved = await this.dependencies.repository.updateProject(updated);
    await this.audit(tenant, "storefront.project.transitioned", saved.id, "Storefront project status transitioned.", input.correlationId, {
      projectId: saved.id,
      from: project.status,
      to: saved.status,
    });
    return saved;
  }

  public listProjects(query: StorefrontProjectListQuery): Promise<StorefrontProjectListResult> {
    return this.dependencies.repository.listProjects(query);
  }

  public async getProject(projectId: string, tenant: TenantContext): Promise<StorefrontProject> {
    const project = await this.dependencies.repository.findProjectById(this.requiredText(projectId, "projectId"));
    if (project?.tenantId !== tenant.tenantId || project.storeId !== tenant.storeId) {
      throw AppError.notFound("Storefront project was not found.", { projectId }, "STOREFRONT_PROJECT_NOT_FOUND");
    }
    return project;
  }

  private async createApproval(tenant: TenantContext, projectId: string, brandName: string, requestedBy: string): Promise<string | undefined> {
    if (this.dependencies.approvalRepository === undefined) {
      return undefined;
    }
    const approvalId = `approval:${projectId}`;
    await this.dependencies.approvalRepository.save(tenant, {
      ...tenant,
      id: approvalId,
      proposalId: projectId,
      title: `Review storefront foundation for ${brandName}`,
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
    storefrontEventType: string,
    entityId: string,
    summary: string,
    correlationId: string | undefined,
    details: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    if (this.dependencies.auditRepository === undefined) {
      return;
    }
    await this.dependencies.auditRepository.append(tenant, {
      ...tenant,
      id: `audit:${entityId}:${this.nextAuditSequence()}:${this.sequence(storefrontEventType)}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "storefront-foundation",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, storefrontEventType, activeSprint: "SACP-03.03A" },
      source: "deterministic-preview",
      sequence: this.sequence(entityId + storefrontEventType),
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "storefront.foundation",
      status: storefrontEventType.includes("failed") ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.timestamp(),
    });
  }

  private foundationSnapshot(profile: StorefrontProfile, selectedProductDraftIds: readonly string[]): Readonly<Record<string, unknown>> {
    return {
      activeSprint: "SACP-03.03A",
      scope: "foundation-only",
      profileId: profile.id,
      profileVersion: profile.version,
      selectedProductDraftIds,
      futureImplementation: {
        homepagePlanning: "inactive",
        productPagePlanning: "inactive",
        collectionPlanning: "inactive",
        navigationPlanning: "inactive",
        metafieldPlanning: "inactive",
        metaobjectPlanning: "inactive",
        themeArtifacts: "inactive",
        previews: "inactive",
        liveShopifyDeployment: "blocked",
      },
    };
  }

  private idempotencyKey(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private requiredText(value: string | undefined, field: string): string {
    const text = this.optionalText(value);
    if (text === undefined) {
      throw AppError.badRequest("Required text field is missing.", { field }, "STOREFRONT_REQUIRED_FIELD_MISSING");
    }
    return text;
  }

  private requireStringList(values: readonly string[] | undefined, field: string): readonly string[] {
    const normalized = this.optionalStringList(values, []);
    if (normalized.length === 0) {
      throw AppError.badRequest("Required list must contain at least one value.", { field }, "STOREFRONT_REQUIRED_LIST_EMPTY");
    }
    return normalized;
  }

  private optionalStringList(values: readonly string[] | undefined, fallback: readonly string[]): readonly string[] {
    const normalized = (values ?? []).map((value) => this.optionalText(value)).filter((value): value is string => value !== undefined);
    return normalized.length === 0 ? fallback : normalized;
  }

  private optionalText(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text === undefined || text.length === 0 ? undefined : text;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private sequence(value: string): number {
    return Math.abs([...value].reduce((sum, character) => sum + character.charCodeAt(0), 0));
  }

  private nextAuditSequence(): number {
    this.auditSequence += 1;
    return this.auditSequence;
  }
}
