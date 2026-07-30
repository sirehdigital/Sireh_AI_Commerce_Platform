import { randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { ProductDraftRepository } from "../../../product-draft/domain/repositories/product-draft.repository.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type {
  ShopifyThemeMapping,
  StorefrontPlan,
  StorefrontProfile,
  StorefrontProject,
  StorefrontTemplate,
} from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";
import {
  CollectionPlanner,
  HomepagePlanner,
  NavigationPlanner,
  PlanningScoreCalculator,
  PlanningValidator,
  ProductPagePlanner,
  type StorefrontPlanningReport,
} from "../planners/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface StorefrontPlanningApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface StorefrontPlanningAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface StorefrontPlanningServiceDependencies {
  readonly storefrontRepository: StorefrontRepository;
  readonly productDraftRepository: ProductDraftRepository;
  readonly approvalRepository?: StorefrontPlanningApprovalRepository;
  readonly auditRepository?: StorefrontPlanningAuditRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export interface PlanStorefrontProjectInput {
  readonly projectId: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export class StorefrontPlanningService {
  private readonly homepagePlanner = new HomepagePlanner();
  private readonly productPagePlanner = new ProductPagePlanner();
  private readonly collectionPlanner = new CollectionPlanner();
  private readonly navigationPlanner = new NavigationPlanner();
  private readonly validator = new PlanningValidator();
  private readonly scoreCalculator = new PlanningScoreCalculator();
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private auditSequence = 0;

  public constructor(private readonly dependencies: StorefrontPlanningServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
  }

  public async planProject(input: PlanStorefrontProjectInput, tenant: TenantContext): Promise<StorefrontProject> {
    const project = await this.getProject(input.projectId, tenant);
    await this.audit(tenant, "PLANNING_STARTED", project.id, "Storefront planning started.", input.correlationId, {
      projectId: project.id,
    });

    const profile = await this.loadProfile(project, tenant);
    const products = await this.loadApprovedProducts(project.selectedProductDraftIds);
    const context = {
      profile,
      products,
      mediaReferencesByProductId: this.mediaReferencesByProductId(products),
      locale: project.locale,
      markets: project.markets,
    };
    const homepage = this.homepagePlanner.plan(context);
    const productPages = this.productPagePlanner.plan(context);
    const collections = this.collectionPlanner.plan(context);
    const navigation = this.navigationPlanner.plan(context);
    const plan: StorefrontPlan = {
      profile,
      homepage,
      productPages,
      collections,
      navigation,
      metadata: {
        productMetafields: [],
        metaobjects: [],
      },
      themeMapping: this.themeMapping(homepage.sections.map((section) => section.id), productPages.map((page) => page.templateId), collections.map((collection) => collection.templateId)),
    };
    const validation = this.validator.validate(plan);
    const score = this.scoreCalculator.score(plan, validation);
    const quality = this.scoreCalculator.toQualityReport(score, validation);
    const timestamp = this.timestamp();

    const approvalId = validation.errors.length === 0
      ? project.approvalId ?? await this.createApproval(tenant, project.id, project.brandName, input.requestedBy ?? "storefront-api")
      : project.approvalId;
    const updated: StorefrontProject = {
      ...project,
      status: validation.errors.length === 0 ? "PENDING_REVIEW" : "FAILED",
      planSnapshot: plan,
      validationSnapshot: validation,
      qualitySnapshot: quality,
      ...(approvalId === undefined ? {} : { approvalId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(validation.errors.length === 0 ? {} : { failureStage: "PLANNING_VALIDATION", failureCode: "STOREFRONT_PLANNING_VALIDATION_FAILED", failureMessage: validation.blockedReasons.join("; ") }),
      updatedAt: timestamp,
      completedAt: timestamp,
    };
    const saved = await this.dependencies.storefrontRepository.updateProject(updated);

    await this.audit(tenant, validation.errors.length === 0 ? "PLANNING_COMPLETED" : "VALIDATION_FAILED", saved.id, validation.errors.length === 0 ? "Storefront planning completed." : "Storefront planning validation failed.", input.correlationId, {
      projectId: saved.id,
      planningScore: quality.overallScore,
      validationErrors: validation.errors.length,
    });
    await this.audit(tenant, "PLANNING_SCORE_UPDATED", saved.id, "Storefront planning score updated.", input.correlationId, {
      projectId: saved.id,
      planningScore: quality.overallScore,
    });

    return saved;
  }

  public async getPlan(projectId: string, tenant: TenantContext): Promise<StorefrontPlan> {
    const project = await this.getProject(projectId, tenant);
    if (!this.isStorefrontPlan(project.planSnapshot)) {
      throw AppError.notFound("Storefront plan was not found.", { projectId }, "STOREFRONT_PLAN_NOT_FOUND");
    }
    return project.planSnapshot;
  }

  public async getPlanningReport(projectId: string, tenant: TenantContext): Promise<StorefrontPlanningReport> {
    const project = await this.getProject(projectId, tenant);
    return {
      validation: {
        errors: project.validationSnapshot.errors.map((issue) => issue.message),
        warnings: project.validationSnapshot.warnings.map((issue) => issue.message),
        requiresReview: project.validationSnapshot.requiresHumanReview,
      },
      score: {
        overall: project.qualitySnapshot.overallScore,
        homepage: project.qualitySnapshot.categoryScores.homepage ?? 0,
        navigation: project.qualitySnapshot.categoryScores.navigation ?? 0,
        productCoverage: project.qualitySnapshot.categoryScores.productCoverage ?? 0,
        collectionCoverage: project.qualitySnapshot.categoryScores.collectionCoverage ?? 0,
        contentCompleteness: project.qualitySnapshot.categoryScores.contentCompleteness ?? 0,
        brandCompleteness: project.qualitySnapshot.categoryScores.brandCompleteness ?? 0,
      },
    };
  }

  private async getProject(projectId: string, tenant: TenantContext): Promise<StorefrontProject> {
    const project = await this.dependencies.storefrontRepository.findProjectById(projectId.trim());
    if (project?.tenantId !== tenant.tenantId || project.storeId !== tenant.storeId) {
      throw AppError.notFound("Storefront project was not found.", { projectId }, "STOREFRONT_PROJECT_NOT_FOUND");
    }
    return project;
  }

  private async loadProfile(project: StorefrontProject, tenant: TenantContext): Promise<StorefrontProfile> {
    if (this.isStorefrontPlan(project.planSnapshot)) {
      return project.planSnapshot.profile;
    }
    const profileId = this.extractProfileId(project.planSnapshot);
    if (profileId === undefined) {
      throw AppError.badRequest("Storefront project is missing its profile reference.", { projectId: project.id }, "STOREFRONT_PROFILE_REFERENCE_MISSING");
    }
    const profile = await this.dependencies.storefrontRepository.findProfile({ tenantId: tenant.tenantId, storeId: tenant.storeId, profileId });
    if (profile === undefined) {
      throw AppError.notFound("Storefront profile was not found.", { profileId }, "STOREFRONT_PROFILE_NOT_FOUND");
    }
    return profile;
  }

  private async loadApprovedProducts(productDraftIds: readonly string[]): Promise<readonly ProductDraft[]> {
    const selected = productDraftIds.length === 0
      ? (await this.dependencies.productDraftRepository.list({ status: "approved", limit: 50 })).items
      : await Promise.all(productDraftIds.map((id) => this.dependencies.productDraftRepository.findById(id)));
    const missing = selected.some((product) => product === null);
    if (missing) {
      throw AppError.badRequest("Storefront planning requires existing product drafts.", {}, "STOREFRONT_PRODUCT_DRAFT_NOT_FOUND");
    }
    const products = selected.filter((product): product is ProductDraft => product !== null);
    const unapproved = products.filter((product) => product.status !== "approved");
    if (unapproved.length > 0) {
      throw AppError.badRequest("Storefront planning only uses approved product drafts.", { productDraftIds: unapproved.map((product) => product.id).join(",") }, "STOREFRONT_PRODUCT_DRAFT_NOT_APPROVED");
    }
    return products;
  }

  private mediaReferencesByProductId(products: readonly ProductDraft[]): Readonly<Record<string, readonly string[]>> {
    return Object.fromEntries(products.map((product) => [
      product.id,
      product.images.filter((image) => image.selected).map((image) => image.id ?? image.sourceUrl),
    ]));
  }

  private themeMapping(homepageSectionIds: readonly string[], productTemplateIds: readonly string[], collectionTemplateIds: readonly string[]): ShopifyThemeMapping {
    const templates: StorefrontTemplate[] = [
      { path: "templates/index.json", type: "index", templateRole: "homepage-plan", sections: homepageSectionIds, payload: {} },
      ...productTemplateIds.map((path): StorefrontTemplate => ({ path, type: "product", templateRole: "product-plan", sections: [], payload: {} })),
      ...collectionTemplateIds.map((path): StorefrontTemplate => ({ path, type: "collection", templateRole: "collection-plan", sections: [], payload: {} })),
    ];
    return {
      templates,
      sectionGroups: [],
      settingsFragments: [],
      metafieldDynamicSources: [],
    };
  }

  private isStorefrontPlan(value: StorefrontProject["planSnapshot"]): value is StorefrontPlan {
    const candidate = value as unknown as Partial<StorefrontPlan>;
    return candidate.profile !== undefined &&
      candidate.homepage !== undefined &&
      Array.isArray(candidate.productPages) &&
      Array.isArray(candidate.collections) &&
      candidate.navigation !== undefined;
  }

  private extractProfileId(value: StorefrontProject["planSnapshot"]): string | undefined {
    const candidate = value as unknown as { readonly profileId?: unknown };
    return typeof candidate.profileId === "string" && candidate.profileId.trim().length > 0 ? candidate.profileId : undefined;
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
      title: `Review storefront plan for ${brandName}`,
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
      id: `audit:${entityId}:${this.nextAuditSequence()}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "storefront-planning",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, storefrontEventType, activeSprint: "SACP-03.03B" },
      source: "deterministic-preview",
      sequence: this.auditSequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "storefront.planning",
      status: storefrontEventType === "VALIDATION_FAILED" ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.timestamp(),
    });
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private nextAuditSequence(): number {
    this.auditSequence += 1;
    return this.auditSequence;
  }
}
