import { randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type {
  StorefrontArtifact,
  StorefrontArtifactType,
  StorefrontPreview,
  StorefrontProject,
  StorefrontQualityReport,
  StorefrontValidationReport,
} from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";
import {
  ThemeArtifactGenerator,
  type SerializedThemeArtifact,
  type ThemeArtifactBundle,
  type ThemeArtifactGenerationResult,
  type ThemePreviewArtifactKind,
} from "../artifacts/index.js";
import type { ShopifyThemeMappingModel } from "../mapping/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface ArtifactPreviewApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface ArtifactPreviewAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface ArtifactPreviewServiceDependencies {
  readonly storefrontRepository: StorefrontRepository;
  readonly approvalRepository?: ArtifactPreviewApprovalRepository;
  readonly auditRepository?: ArtifactPreviewAuditRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
  readonly generator?: ThemeArtifactGenerator;
}

export interface GenerateArtifactPreviewInput {
  readonly projectId: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface ArtifactPreviewResult {
  readonly project: StorefrontProject;
  readonly generation: ThemeArtifactGenerationResult;
  readonly artifacts: readonly StorefrontArtifact[];
  readonly preview: StorefrontPreview;
  readonly approvalId?: string;
}

export class ArtifactPreviewService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly generator: ThemeArtifactGenerator;
  private auditSequence = 0;

  public constructor(private readonly dependencies: ArtifactPreviewServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
    this.generator = dependencies.generator ?? new ThemeArtifactGenerator();
  }

  public async generatePreview(input: GenerateArtifactPreviewInput, tenant: TenantContext): Promise<ArtifactPreviewResult> {
    const project = await this.getProject(input.projectId, tenant);
    this.requirePlanOnly(project);
    await this.audit(tenant, "ARTIFACT_GENERATION_STARTED", project.id, "Theme artifact preview generation started.", input.correlationId, {
      projectId: project.id,
      mode: project.mode,
    });
    const timestamp = this.timestamp();
    const mapping = await this.getMapping(project.id);
    const generation = this.generator.generate({ project, mapping, generatedAt: timestamp });
    const artifacts = this.toStorefrontArtifacts(project, generation.artifacts, timestamp);
    const savedArtifacts = await this.dependencies.storefrontRepository.saveArtifacts(project.id, artifacts);
    await this.audit(tenant, generation.validation.errors.length === 0 ? "ARTIFACT_VALIDATED" : "ARTIFACT_VALIDATION_FAILED", project.id, generation.validation.errors.length === 0 ? "Theme artifact preview validation completed." : "Theme artifact preview validation failed.", input.correlationId, {
      projectId: project.id,
      validationErrors: generation.validation.errors.length,
      validationWarnings: generation.validation.warnings.length,
      validationScore: generation.validationScore,
    });
    const approvalId = generation.validation.errors.length === 0
      ? project.approvalId ?? await this.createApproval(tenant, project.id, project.brandName, input.requestedBy ?? "storefront-api")
      : project.approvalId;
    const updatedProject = await this.dependencies.storefrontRepository.updateProject({
      ...project,
      status: generation.validation.errors.length === 0 ? "PENDING_REVIEW" : "FAILED",
      validationSnapshot: generation.validation,
      qualitySnapshot: this.withArtifactQuality(project.qualitySnapshot, generation.validation, generation.validationScore),
      ...(approvalId === undefined ? {} : { approvalId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(generation.validation.errors.length === 0 ? {} : {
        failureStage: "ARTIFACT_VALIDATION",
        failureCode: "STOREFRONT_ARTIFACT_VALIDATION_FAILED",
        failureMessage: generation.validation.blockedReasons.join("; "),
      }),
      updatedAt: timestamp,
      completedAt: timestamp,
    });
    const preview = await this.dependencies.storefrontRepository.savePreview({
      id: `storefront-preview:${project.id}:artifact-preview`,
      storefrontProjectId: project.id,
      planSnapshot: project.planSnapshot,
      generatedArtifactReferences: savedArtifacts.map((artifact) => artifact.path),
      themeTarget: { type: "UNKNOWN", reference: "PLAN_ONLY_ARTIFACT_PREVIEW" },
      selectedProductDraftIds: project.selectedProductDraftIds,
      qualityReport: updatedProject.qualitySnapshot,
      validationReport: generation.validation,
      previewStatus: generation.validation.errors.length === 0 ? "ARTIFACT_PREVIEW" : "FAILED",
      previewUrl: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.audit(tenant, generation.validation.errors.length === 0 ? "ARTIFACT_GENERATION_COMPLETED" : "ARTIFACT_VALIDATION_FAILED", project.id, generation.validation.errors.length === 0 ? "Theme artifact preview bundle completed and pending review." : "Theme artifact preview bundle failed validation.", input.correlationId, {
      projectId: project.id,
      status: updatedProject.status,
      artifactCount: savedArtifacts.length,
      bundleHash: generation.bundle.bundleHash,
      approvalId: updatedProject.approvalId ?? null,
    });

    return {
      project: updatedProject,
      generation,
      artifacts: savedArtifacts,
      preview,
      ...(updatedProject.approvalId === undefined ? {} : { approvalId: updatedProject.approvalId }),
    };
  }

  public async listArtifacts(projectId: string, tenant: TenantContext): Promise<readonly StorefrontArtifact[]> {
    await this.getProject(projectId, tenant);
    const artifacts = await this.dependencies.storefrontRepository.listArtifacts(projectId);
    if (!artifacts.some((artifact) => artifact.path === "theme-preview/bundle.json")) {
      throw AppError.notFound("Theme artifact preview bundle was not found.", { projectId }, "STOREFRONT_ARTIFACT_BUNDLE_NOT_FOUND");
    }
    return artifacts;
  }

  public async getBundle(projectId: string, tenant: TenantContext): Promise<ThemeArtifactBundle> {
    const artifacts = await this.listArtifacts(projectId, tenant);
    const artifact = artifacts.find((item) => item.path === "theme-preview/bundle.json");
    if (artifact === undefined) {
      throw AppError.notFound("Theme artifact preview bundle was not found.", { projectId }, "STOREFRONT_ARTIFACT_BUNDLE_NOT_FOUND");
    }
    return artifact.contentSnapshot as unknown as ThemeArtifactBundle;
  }

  public async getValidation(projectId: string, tenant: TenantContext): Promise<StorefrontValidationReport> {
    const project = await this.getProject(projectId, tenant);
    if (!(await this.dependencies.storefrontRepository.listArtifacts(projectId)).some((artifact) => artifact.path === "theme-preview/bundle.json")) {
      throw AppError.notFound("Theme artifact validation was not found.", { projectId }, "STOREFRONT_ARTIFACT_VALIDATION_NOT_FOUND");
    }
    return project.validationSnapshot;
  }

  private async getProject(projectId: string, tenant: TenantContext): Promise<StorefrontProject> {
    const normalizedProjectId = this.requiredText(projectId, "projectId");
    const project = await this.dependencies.storefrontRepository.findProjectById(normalizedProjectId);
    if (project?.tenantId !== tenant.tenantId || project.storeId !== tenant.storeId) {
      throw AppError.notFound("Storefront project was not found.", { projectId: normalizedProjectId }, "STOREFRONT_PROJECT_NOT_FOUND");
    }
    return project;
  }

  private requirePlanOnly(project: StorefrontProject): void {
    if (project.mode !== "PLAN_ONLY") {
      throw AppError.badRequest("Theme artifact preview generation supports PLAN_ONLY projects only.", { projectId: project.id, mode: project.mode }, "STOREFRONT_MODE_NOT_ACTIVE");
    }
  }

  private async getMapping(projectId: string): Promise<ShopifyThemeMappingModel> {
    const artifact = (await this.dependencies.storefrontRepository.listArtifacts(projectId)).find((item) => item.path === "theme-preview/theme-mapping.json");
    if (artifact === undefined) {
      throw AppError.badRequest("Theme mapping must be generated before artifact preview generation.", { projectId }, "STOREFRONT_THEME_MAPPING_REQUIRED");
    }
    return artifact.contentSnapshot as unknown as ShopifyThemeMappingModel;
  }

  private toStorefrontArtifacts(
    project: StorefrontProject,
    artifacts: readonly SerializedThemeArtifact[],
    timestamp: string,
  ): readonly StorefrontArtifact[] {
    return artifacts.map((artifact, index): StorefrontArtifact => ({
      id: `storefront-artifact:${project.id}:artifact-preview:${index + 1}`,
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

  private artifactType(kind: ThemePreviewArtifactKind): StorefrontArtifactType {
    switch (kind) {
      case "NAVIGATION_JSON":
        return "NAVIGATION_PLAN";
      case "METAFIELD_DEFINITIONS_JSON":
        return "METAFIELD_PLAN";
      case "METAOBJECT_DEFINITIONS_JSON":
        return "METAOBJECT_PLAN";
      case "THEME_SETTINGS_JSON":
      case "SECTION_DEFINITIONS_JSON":
      case "BLOCK_DEFINITIONS_JSON":
      case "DYNAMIC_SOURCE_REFERENCES_JSON":
      case "ASSET_MANIFEST_JSON":
        return "SECTION_CONFIG";
      case "THEME_MAPPING_SOURCE":
      case "HOMEPAGE_JSON":
      case "PRODUCT_TEMPLATE_JSON":
      case "COLLECTION_TEMPLATE_JSON":
      case "MANIFEST_INDEX_JSON":
      case "BUNDLE_METADATA_JSON":
        return "JSON_TEMPLATE";
    }
  }

  private withArtifactQuality(
    current: StorefrontQualityReport,
    validation: StorefrontValidationReport,
    validationScore: number,
  ): StorefrontQualityReport {
    return {
      ...current,
      overallScore: validation.errors.length === 0 ? Math.max(current.overallScore, Math.min(95, validationScore)) : Math.min(current.overallScore, 40),
      categoryScores: {
        ...current.categoryScores,
        artifactValidation: validationScore,
      },
      errors: validation.errors.map((issue) => issue.message),
      warnings: validation.warnings.map((issue) => issue.message),
      recommendations: current.recommendations.concat("Review the preview artifact bundle before any future Shopify upload or activation sprint."),
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
      title: `Review theme artifact preview bundle for ${brandName}`,
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
      id: `audit:${entityId}:artifact-preview:${this.nextAuditSequence()}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "storefront-artifact-preview",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, storefrontEventType, activeSprint: "SACP-03.03D" },
      source: "deterministic-preview",
      sequence: this.auditSequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "storefront.artifact-preview",
      status: storefrontEventType === "ARTIFACT_VALIDATION_FAILED" ? "BLOCKED" : "READY_FOR_REVIEW",
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
