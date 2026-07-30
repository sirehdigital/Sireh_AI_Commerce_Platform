import { randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type {
  StorefrontArtifact,
  StorefrontArtifactType,
  StorefrontPlan,
  StorefrontPreview,
  StorefrontProject,
  StorefrontQualityReport,
  StorefrontTemplate,
  StorefrontThemeSettingsFragment,
  StorefrontValidationReport,
} from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";
import { ShopifyThemeMapper, type ShopifyThemeMappingModel, type ShopifyThemePreviewArtifactModel } from "../mapping/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface ThemeMappingApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface ThemeMappingAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface ThemeMappingServiceDependencies {
  readonly storefrontRepository: StorefrontRepository;
  readonly approvalRepository?: ThemeMappingApprovalRepository;
  readonly auditRepository?: ThemeMappingAuditRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
  readonly mapper?: ShopifyThemeMapper;
}

export interface MapThemeInput {
  readonly projectId: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface ThemeMappingResult {
  readonly project: StorefrontProject;
  readonly mapping: ShopifyThemeMappingModel;
  readonly previewArtifacts: readonly ShopifyThemePreviewArtifactModel[];
  readonly validation: StorefrontValidationReport;
  readonly approvalId?: string;
}

export interface ThemePreviewResult {
  readonly projectId: string;
  readonly status: StorefrontProject["status"];
  readonly preview: StorefrontPreview;
  readonly artifacts: readonly StorefrontArtifact[];
}

export class ThemeMappingService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly mapper: ShopifyThemeMapper;
  private auditSequence = 0;

  public constructor(private readonly dependencies: ThemeMappingServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
    this.mapper = dependencies.mapper ?? new ShopifyThemeMapper();
  }

  public async mapProject(input: MapThemeInput, tenant: TenantContext): Promise<ThemeMappingResult> {
    const project = await this.getProject(input.projectId, tenant);
    const plan = this.requirePlan(project);
    await this.audit(tenant, "THEME_MAPPING_STARTED", project.id, "Shopify theme mapping started.", input.correlationId, {
      projectId: project.id,
      mode: project.mode,
    });

    const timestamp = this.timestamp();
    const mapping = this.mapper.map({ projectId: project.id, plan, generatedAt: timestamp });
    const artifacts = this.toArtifacts(project, mapping.previewArtifacts, timestamp);
    const savedArtifacts = await this.dependencies.storefrontRepository.saveArtifacts(project.id, artifacts);
    const validation = mapping.validation;
    await this.audit(tenant, "THEME_MAPPING_VALIDATED", project.id, "Shopify theme mapping validated.", input.correlationId, {
      projectId: project.id,
      validationErrors: validation.errors.length,
      validationWarnings: validation.warnings.length,
    });

    const approvalId = validation.errors.length === 0
      ? project.approvalId ?? await this.createApproval(tenant, project.id, project.brandName, input.requestedBy ?? "storefront-api")
      : project.approvalId;
    const updatedPlan = this.withThemeMapping(plan, mapping);
    const updatedProject: StorefrontProject = {
      ...project,
      status: validation.errors.length === 0 ? "PENDING_REVIEW" : "FAILED",
      planSnapshot: updatedPlan,
      validationSnapshot: validation,
      qualitySnapshot: this.withThemeMappingQuality(project.qualitySnapshot, validation),
      ...(approvalId === undefined ? {} : { approvalId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(validation.errors.length === 0 ? {} : {
        failureStage: "THEME_MAPPING_VALIDATION",
        failureCode: "STOREFRONT_THEME_MAPPING_VALIDATION_FAILED",
        failureMessage: validation.blockedReasons.join("; "),
      }),
      updatedAt: timestamp,
      completedAt: timestamp,
    };
    const savedProject = await this.dependencies.storefrontRepository.updateProject(updatedProject);
    await this.dependencies.storefrontRepository.savePreview({
      id: `storefront-preview:${project.id}:theme-mapping`,
      storefrontProjectId: project.id,
      planSnapshot: updatedPlan,
      generatedArtifactReferences: savedArtifacts.map((artifact) => artifact.path),
      themeTarget: { type: "UNKNOWN", reference: "PLAN_ONLY_THEME_MAPPING" },
      selectedProductDraftIds: project.selectedProductDraftIds,
      qualityReport: savedProject.qualitySnapshot,
      validationReport: validation,
      previewStatus: validation.errors.length === 0 ? "CONFIGURATION_PREVIEW" : "FAILED",
      previewUrl: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.audit(tenant, validation.errors.length === 0 ? "THEME_MAPPING_COMPLETED" : "THEME_MAPPING_FAILED", project.id, validation.errors.length === 0 ? "Shopify theme mapping completed and pending review." : "Shopify theme mapping failed validation.", input.correlationId, {
      projectId: project.id,
      status: savedProject.status,
      artifactCount: savedArtifacts.length,
      approvalId: savedProject.approvalId ?? null,
    });

    return {
      project: savedProject,
      mapping,
      previewArtifacts: mapping.previewArtifacts,
      validation,
      ...(savedProject.approvalId === undefined ? {} : { approvalId: savedProject.approvalId }),
    };
  }

  public async getThemeMapping(projectId: string, tenant: TenantContext): Promise<ShopifyThemeMappingModel> {
    await this.getProject(projectId, tenant);
    const artifacts = await this.dependencies.storefrontRepository.listArtifacts(projectId);
    const mappingArtifact = artifacts.find((artifact) => artifact.path === "theme-preview/theme-mapping.json");
    if (mappingArtifact === undefined) {
      throw AppError.notFound("Shopify theme mapping was not found.", { projectId }, "STOREFRONT_THEME_MAPPING_NOT_FOUND");
    }
    return mappingArtifact.contentSnapshot as unknown as ShopifyThemeMappingModel;
  }

  public async getThemePreview(projectId: string, tenant: TenantContext): Promise<ThemePreviewResult> {
    const project = await this.getProject(projectId, tenant);
    const preview = await this.dependencies.storefrontRepository.findPreviewByProjectId(projectId);
    if (preview === undefined) {
      throw AppError.notFound("Shopify theme preview was not found.", { projectId }, "STOREFRONT_THEME_PREVIEW_NOT_FOUND");
    }
    return {
      projectId,
      status: project.status,
      preview,
      artifacts: await this.dependencies.storefrontRepository.listArtifacts(projectId),
    };
  }

  private async getProject(projectId: string, tenant: TenantContext): Promise<StorefrontProject> {
    const normalizedProjectId = this.requiredText(projectId, "projectId");
    const project = await this.dependencies.storefrontRepository.findProjectById(normalizedProjectId);
    if (project?.tenantId !== tenant.tenantId || project.storeId !== tenant.storeId) {
      throw AppError.notFound("Storefront project was not found.", { projectId: normalizedProjectId }, "STOREFRONT_PROJECT_NOT_FOUND");
    }
    return project;
  }

  private requirePlan(project: StorefrontProject): StorefrontPlan {
    const candidate = project.planSnapshot as unknown as Partial<StorefrontPlan>;
    if (candidate.profile === undefined || candidate.homepage === undefined || !Array.isArray(candidate.productPages) || !Array.isArray(candidate.collections) || candidate.navigation === undefined) {
      throw AppError.badRequest("Storefront project must be planned before theme mapping.", { projectId: project.id }, "STOREFRONT_PLAN_REQUIRED");
    }
    if (project.mode !== "PLAN_ONLY") {
      throw AppError.badRequest("Theme mapping currently supports PLAN_ONLY projects only.", { projectId: project.id, mode: project.mode }, "STOREFRONT_MODE_NOT_ACTIVE");
    }
    return project.planSnapshot;
  }

  private toArtifacts(
    project: StorefrontProject,
    previewArtifacts: readonly ShopifyThemePreviewArtifactModel[],
    timestamp: string,
  ): readonly StorefrontArtifact[] {
    return previewArtifacts.map((artifact, index): StorefrontArtifact => ({
      id: `storefront-artifact:${project.id}:theme-mapping:${index + 1}`,
      storefrontProjectId: project.id,
      artifactType: this.artifactType(artifact.kind),
      path: artifact.path,
      contentHash: artifact.contentHash,
      format: "json",
      status: "GENERATED",
      contentSnapshot: artifact.payload,
      sourceReferences: project.selectedProductDraftIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }

  private artifactType(kind: ShopifyThemePreviewArtifactModel["kind"]): StorefrontArtifactType {
    switch (kind) {
      case "HOMEPAGE_PREVIEW":
      case "PRODUCT_PREVIEW":
      case "COLLECTION_PREVIEW":
      case "THEME_MAPPING_PREVIEW":
        return "JSON_TEMPLATE";
      case "NAVIGATION_PREVIEW":
        return "NAVIGATION_PLAN";
      case "METAFIELD_DEFINITIONS_PREVIEW":
        return "METAFIELD_PLAN";
      case "METAOBJECT_DEFINITIONS_PREVIEW":
        return "METAOBJECT_PLAN";
      case "THEME_SETTINGS_PREVIEW":
        return "SECTION_CONFIG";
    }
  }

  private withThemeMapping(plan: StorefrontPlan, mapping: ShopifyThemeMappingModel): StorefrontPlan {
    return {
      ...plan,
      themeMapping: {
        templates: [
          this.template(mapping.homepage),
          ...mapping.products.map((template) => this.template(template)),
          ...mapping.collections.map((template) => this.template(template)),
        ],
        sectionGroups: [],
        settingsFragments: this.settingsFragments(mapping),
        metafieldDynamicSources: mapping.metafields.map((field) => field.dynamicSource),
      },
    };
  }

  private template(template: ShopifyThemeMappingModel["homepage"]): StorefrontTemplate {
    return {
      path: template.path,
      type: template.templateType,
      templateRole: template.role,
      sections: template.order,
      payload: {
        sections: Object.fromEntries(template.sections.map((section) => [section.id, {
          type: section.type,
          settings: section.settings,
          blocks: section.blocks,
        }])),
        order: template.order,
        seo: template.seo,
      },
    };
  }

  private settingsFragments(mapping: ShopifyThemeMappingModel): readonly StorefrontThemeSettingsFragment[] {
    const entries = {
      "theme.colors.primary": mapping.settings.brandColors.primary ?? null,
      "theme.colors.background": mapping.settings.brandColors.background ?? null,
      "theme.colors.accent": mapping.settings.brandColors.accent ?? null,
      "theme.typography.heading": mapping.settings.typography.heading ?? null,
      "theme.buttons.radius": mapping.settings.buttons.borderRadius ?? null,
      "theme.container.width": mapping.settings.containerWidth,
      "theme.newsletter.enabled": mapping.settings.newsletterEnabled,
    };
    return Object.entries(entries).map(([key, value]) => ({
      key,
      value,
      mergeStrategy: "MERGE_ONLY",
    }));
  }

  private withThemeMappingQuality(
    current: StorefrontQualityReport,
    validation: StorefrontValidationReport,
  ): StorefrontQualityReport {
    const themeMappingScore = validation.errors.length === 0 ? 95 : 25;
    return {
      ...current,
      overallScore: validation.errors.length === 0 ? Math.max(current.overallScore, 80) : Math.min(current.overallScore, 40),
      categoryScores: {
        ...current.categoryScores,
        themeMapping: themeMappingScore,
      },
      errors: validation.errors.map((issue) => issue.message),
      warnings: validation.warnings.map((issue) => issue.message),
      recommendations: current.recommendations.concat("Review Shopify theme mapping preview artifacts before any future deployment sprint."),
      requiresHumanReview: true,
      renderedVisualQuality: "UNKNOWN",
    };
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
      title: `Review Shopify theme mapping for ${brandName}`,
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
      id: `audit:${entityId}:theme-mapping:${this.nextAuditSequence()}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "storefront-theme-mapping",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, storefrontEventType, activeSprint: "SACP-03.03C" },
      source: "deterministic-preview",
      sequence: this.auditSequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "storefront.theme-mapping",
      status: storefrontEventType === "THEME_MAPPING_FAILED" ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.timestamp(),
    });
  }

  private requiredText(value: string | undefined, field: string): string {
    const text = value?.trim();
    if (text === undefined || text.length === 0) {
      throw AppError.badRequest("Required text field is missing.", { field }, "STOREFRONT_REQUIRED_FIELD_MISSING");
    }
    return text;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private nextAuditSequence(): number {
    this.auditSequence += 1;
    return this.auditSequence;
  }
}
