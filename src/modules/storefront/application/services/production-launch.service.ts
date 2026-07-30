import { randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ApprovalRecord, TenantContext } from "../../../saie/application/index.js";
import type { ShopifyThemeGateway } from "../gateways/index.js";
import { DisabledShopifyThemeGateway } from "../../infrastructure/gateways/index.js";
import type { StorefrontArtifact, StorefrontProject } from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";
import { ArtifactSerializer } from "../artifacts/index.js";
import {
  ProductionHealthMonitor,
  ReleaseAuditService,
  ReleaseManager,
  ReleaseSummaryBuilder,
  ReleaseValidator,
  RollbackExecutor,
  ThemeActivationService,
  type DeploymentReadinessResult,
  type ProductionReleaseSummary,
  type ReleaseMetadata,
  type RollbackMetadata,
} from "../release/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface ProductionLaunchApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface ProductionDeploymentVerifier {
  verify(input: {
    readonly project: StorefrontProject;
    readonly artifacts: readonly StorefrontArtifact[];
  }): MaybePromise<DeploymentReadinessResult>;
}

export interface ProductionLaunchServiceDependencies {
  readonly storefrontRepository: StorefrontRepository;
  readonly approvalRepository?: ProductionLaunchApprovalRepository;
  readonly auditRepository?: ConstructorParameters<typeof ReleaseAuditService>[0];
  readonly deploymentVerifier?: ProductionDeploymentVerifier;
  readonly shopifyThemeGateway?: ShopifyThemeGateway;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export interface ProductionReleaseInput {
  readonly projectId: string;
  readonly releaseNotes?: readonly string[];
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface ProductionReleaseResult {
  readonly project: StorefrontProject;
  readonly release: ReleaseMetadata;
  readonly summary: ProductionReleaseSummary;
  readonly artifacts: readonly StorefrontArtifact[];
}

export interface RollbackInput {
  readonly projectId: string;
  readonly releaseId?: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export class ProductionLaunchService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly deploymentVerifier: ProductionDeploymentVerifier;
  private readonly activationService: ThemeActivationService;
  private readonly auditService: ReleaseAuditService;
  private readonly releaseValidator = new ReleaseValidator();
  private readonly releaseManager = new ReleaseManager();
  private readonly healthMonitor = new ProductionHealthMonitor();
  private readonly summaryBuilder = new ReleaseSummaryBuilder();
  private readonly rollbackExecutor = new RollbackExecutor();
  private readonly serializer = new ArtifactSerializer();

  public constructor(private readonly dependencies: ProductionLaunchServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
    this.deploymentVerifier = dependencies.deploymentVerifier ?? new DisabledDeploymentVerifier();
    this.activationService = new ThemeActivationService(dependencies.shopifyThemeGateway ?? new DisabledShopifyThemeGateway());
    this.auditService = new ReleaseAuditService(dependencies.auditRepository, this.now, this.idGenerator);
  }

  public async release(input: ProductionReleaseInput, tenant: TenantContext): Promise<ProductionReleaseResult> {
    const project = await this.getProject(input.projectId, tenant);
    const artifacts = await this.dependencies.storefrontRepository.listArtifacts(project.id);
    await this.auditService.record(tenant, "PRODUCTION_RELEASE_STARTED", project.id, "Production release started.", input.correlationId, {
      projectId: project.id,
      status: project.status,
    });

    const deployment = await this.deploymentVerifier.verify({ project, artifacts });
    const validation = this.releaseValidator.validate({ project, artifacts, deployment });
    if (validation.report.errors.length > 0) {
      throw AppError.badRequest("Production release readiness validation failed.", {
        projectId: project.id,
        blockedReasons: validation.report.blockedReasons.join("; "),
      }, "STOREFRONT_PRODUCTION_RELEASE_BLOCKED");
    }

    const activation = await this.activationService.activate();
    if (!activation.ok) {
      throw AppError.badRequest("Theme activation failed.", {
        projectId: project.id,
        failureCode: activation.failureCode ?? "THEME_ACTIVATION_FAILED",
      }, activation.failureCode ?? "THEME_ACTIVATION_FAILED");
    }

    const timestamp = this.timestamp();
    const release = this.releaseManager.register({
      releaseId: `release:${project.id}:${this.idGenerator()}`,
      projectId: project.id,
      version: this.version(timestamp),
      deployment,
      bundleHash: validation.bundleHash,
      artifactCount: validation.artifactCount,
      releaseNotes: this.releaseNotes(input.releaseNotes),
      timestamp,
    });
    const health = this.healthMonitor.check({ release, deployment, activationOk: activation.ok, checkedAt: timestamp });
    const summary = this.summaryBuilder.build(release, health);
    const savedArtifacts = await this.saveReleaseArtifacts(project, artifacts, release, summary, undefined, timestamp);
    const updatedProject = await this.dependencies.storefrontRepository.updateProject({
      ...project,
      status: "DEPLOYED",
      qualitySnapshot: {
        ...project.qualitySnapshot,
        categoryScores: { ...project.qualitySnapshot.categoryScores, productionHealth: health.noPartialActivation ? 100 : 20 },
        recommendations: project.qualitySnapshot.recommendations.concat("Production release metadata registered."),
      },
      updatedAt: timestamp,
      completedAt: timestamp,
    });
    await this.auditService.record(tenant, "THEME_ACTIVATED", project.id, "Theme activation completed.", input.correlationId, {
      projectId: project.id,
      releaseId: release.releaseId,
      activatedThemeId: release.activatedThemeId,
    });
    await this.auditService.record(tenant, "PRODUCTION_RELEASE_COMPLETED", project.id, "Production release completed.", input.correlationId, {
      projectId: project.id,
      releaseId: release.releaseId,
      version: release.version,
    });

    return { project: updatedProject, release, summary, artifacts: savedArtifacts };
  }

  public async getRelease(projectId: string, tenant: TenantContext): Promise<ProductionReleaseSummary> {
    await this.getProject(projectId, tenant);
    const artifact = await this.findArtifact(projectId, "theme-release/release-summary.json");
    return artifact.contentSnapshot as unknown as ProductionReleaseSummary;
  }

  public async getReleaseHistory(projectId: string, tenant: TenantContext): Promise<readonly ReleaseMetadata[]> {
    await this.getProject(projectId, tenant);
    const artifact = await this.findArtifact(projectId, "theme-release/release-history.json");
    const payload = artifact.contentSnapshot as { readonly releases?: readonly ReleaseMetadata[] };
    return payload.releases ?? [];
  }

  public async rollback(input: RollbackInput, tenant: TenantContext): Promise<RollbackMetadata> {
    const project = await this.getProject(input.projectId, tenant);
    const history = await this.getReleaseHistory(project.id, tenant);
    const release = input.releaseId === undefined ? history[history.length - 1] : history.find((item) => item.releaseId === input.releaseId);
    if (release === undefined) {
      throw AppError.notFound("Release metadata was not found.", { projectId: project.id }, "STOREFRONT_RELEASE_NOT_FOUND");
    }
    const timestamp = this.timestamp();
    const rollback = this.rollbackExecutor.execute({
      rollbackId: `rollback:${project.id}:${this.idGenerator()}`,
      release,
      executedAt: timestamp,
    });
    const artifacts = await this.dependencies.storefrontRepository.listArtifacts(project.id);
    const summaryArtifact = artifacts.find((artifact) => artifact.path === "theme-release/release-summary.json");
    const summary = summaryArtifact?.contentSnapshot as ProductionReleaseSummary | undefined;
    await this.saveReleaseArtifacts(project, artifacts, { ...release, status: rollback.status === "EXECUTED" ? "ROLLED_BACK" : "FAILED", updatedAt: timestamp }, summary, rollback, timestamp);
    await this.dependencies.storefrontRepository.updateProject({
      ...project,
      status: rollback.status === "EXECUTED" ? "READY_FOR_DEPLOYMENT" : "FAILED",
      validationSnapshot: rollback.validation,
      ...(rollback.status === "EXECUTED" ? {} : {
        failureStage: "ROLLBACK_VALIDATION",
        failureCode: "STOREFRONT_ROLLBACK_FAILED",
        failureMessage: rollback.validation.blockedReasons.join("; "),
      }),
      updatedAt: timestamp,
      completedAt: timestamp,
    });
    await this.auditService.record(tenant, rollback.status === "EXECUTED" ? "ROLLBACK_EXECUTED" : "ROLLBACK_FAILED", project.id, rollback.status === "EXECUTED" ? "Rollback executed." : "Rollback failed.", input.correlationId, {
      projectId: project.id,
      releaseId: release.releaseId,
      rollbackId: rollback.rollbackId,
    });
    return rollback;
  }

  private async getProject(projectId: string, tenant: TenantContext): Promise<StorefrontProject> {
    const project = await this.dependencies.storefrontRepository.findProjectById(this.requiredText(projectId, "projectId"));
    if (project?.tenantId !== tenant.tenantId || project.storeId !== tenant.storeId) {
      throw AppError.notFound("Storefront project was not found.", { projectId }, "STOREFRONT_PROJECT_NOT_FOUND");
    }
    return project;
  }

  private async findArtifact(projectId: string, path: string): Promise<StorefrontArtifact> {
    const artifact = (await this.dependencies.storefrontRepository.listArtifacts(projectId)).find((item) => item.path === path);
    if (artifact === undefined) {
      throw AppError.notFound("Release artifact was not found.", { projectId, path }, "STOREFRONT_RELEASE_NOT_FOUND");
    }
    return artifact;
  }

  private async saveReleaseArtifacts(
    project: StorefrontProject,
    currentArtifacts: readonly StorefrontArtifact[],
    release: ReleaseMetadata,
    summary: ProductionReleaseSummary | undefined,
    rollback: RollbackMetadata | undefined,
    timestamp: string,
  ): Promise<readonly StorefrontArtifact[]> {
    const existingHistoryArtifact = currentArtifacts.find((artifact) => artifact.path === "theme-release/release-history.json");
    const existingHistory = (existingHistoryArtifact?.contentSnapshot as { readonly releases?: readonly ReleaseMetadata[] } | undefined)?.releases ?? [];
    const releaseHistory = existingHistory.filter((item) => item.releaseId !== release.releaseId).concat(release);
    const releaseArtifacts = [
      this.artifact(project, "theme-release/release.json", release as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-release/release-history.json", { releases: releaseHistory }, timestamp),
      ...(summary === undefined ? [] : [this.artifact(project, "theme-release/release-summary.json", summary as unknown as Readonly<Record<string, unknown>>, timestamp)]),
      ...(rollback === undefined ? [] : [this.artifact(project, "theme-release/rollback.json", rollback as unknown as Readonly<Record<string, unknown>>, timestamp)]),
    ];
    const preserved = currentArtifacts.filter((artifact) => !artifact.path.startsWith("theme-release/"));
    return this.dependencies.storefrontRepository.saveArtifacts(project.id, preserved.concat(releaseArtifacts));
  }

  private artifact(project: StorefrontProject, path: string, payload: Readonly<Record<string, unknown>>, timestamp: string): StorefrontArtifact {
    return {
      id: `storefront-artifact:${project.id}:${path.replace(/[^a-z0-9]+/giu, "-")}`,
      storefrontProjectId: project.id,
      artifactType: "DEPLOYMENT_MANIFEST",
      path,
      contentHash: this.serializer.hash(payload),
      format: "json",
      status: "GENERATED",
      contentSnapshot: payload,
      sourceReferences: project.selectedProductDraftIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private releaseNotes(notes: readonly string[] | undefined): readonly string[] {
    const normalized = (notes ?? []).map((note) => note.trim()).filter((note) => note.length > 0);
    return normalized.length === 0 ? ["Production release activated after storefront validation gates passed."] : normalized;
  }

  private version(timestamp: string): string {
    return `storefront-${timestamp.replace(/[-:.]/gu, "").replace("T", "-").replace("Z", "")}`;
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
}

class DisabledDeploymentVerifier implements ProductionDeploymentVerifier {
  public verify(): DeploymentReadinessResult {
    return {
      ok: false,
      deploymentReference: "missing-deployment-engine",
      previousActiveThemeId: null,
      targetThemeId: "unknown",
      compatibilityPassed: false,
      validationPassed: false,
      warnings: [],
      failureCode: "STOREFRONT_DEPLOYMENT_ENGINE_MISSING",
      failureMessage: "Safe Shopify Theme Deployment Engine is not available in this checkout.",
    };
  }
}
