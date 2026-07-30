import { randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type { StorefrontArtifact, StorefrontProject } from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";
import { ArtifactSerializer, type ThemeArtifactBundle } from "../artifacts/index.js";
import {
  DeploymentCompatibilityChecker,
  DeploymentHealthChecker,
  DeploymentHistoryBuilder,
  DeploymentPackageBuilder,
  DeploymentPlanner,
  DeploymentVerifier,
  DraftThemeUploader,
  NoOpDeploymentGateway,
  RollbackPreparationService,
  type DeploymentGateway,
  type DeploymentHealthReport,
  type DeploymentHistory,
  type DeploymentPlan,
  type DeploymentResult,
  type RollbackPreparation,
} from "../deployment/index.js";
import type { DeploymentReadinessResult } from "../release/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface SafeDeploymentApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface SafeDeploymentAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface SafeDeploymentServiceDependencies {
  readonly storefrontRepository: StorefrontRepository;
  readonly approvalRepository?: SafeDeploymentApprovalRepository;
  readonly auditRepository?: SafeDeploymentAuditRepository;
  readonly deploymentGateway?: DeploymentGateway;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export interface DeploymentPlanInput {
  readonly projectId: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface SafeDeployInput {
  readonly projectId: string;
  readonly requestedBy?: string;
  readonly correlationId?: string;
}

export interface DeploymentPlanResult {
  readonly project: StorefrontProject;
  readonly plan: DeploymentPlan;
  readonly compatibility: ReturnType<DeploymentCompatibilityChecker["check"]>;
  readonly artifacts: readonly StorefrontArtifact[];
}

export interface SafeDeploymentResult {
  readonly project: StorefrontProject;
  readonly deployment: DeploymentResult;
  readonly health: DeploymentHealthReport;
  readonly rollback: RollbackPreparation;
  readonly history: DeploymentHistory;
  readonly artifacts: readonly StorefrontArtifact[];
}

export class SafeDeploymentService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly serializer = new ArtifactSerializer();
  private readonly checker = new DeploymentCompatibilityChecker();
  private readonly planner = new DeploymentPlanner();
  private readonly packageBuilder = new DeploymentPackageBuilder();
  private readonly uploader: DraftThemeUploader;
  private readonly healthChecker = new DeploymentHealthChecker();
  private readonly rollbackPreparation = new RollbackPreparationService();
  private readonly historyBuilder = new DeploymentHistoryBuilder();
  private readonly verifier = new DeploymentVerifier();
  private auditSequence = 0;

  public constructor(private readonly dependencies: SafeDeploymentServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? randomUUID;
    this.uploader = new DraftThemeUploader(dependencies.deploymentGateway ?? new NoOpDeploymentGateway());
  }

  public async createDeploymentPlan(input: DeploymentPlanInput, tenant: TenantContext): Promise<DeploymentPlanResult> {
    const project = await this.ensureApproval(await this.getProject(input.projectId, tenant), tenant, input.requestedBy ?? "storefront-api");
    const artifacts = await this.dependencies.storefrontRepository.listArtifacts(project.id);
    const bundle = this.getBundle(project.id, artifacts);
    const compatibility = this.checker.check({ project, artifacts });
    const timestamp = this.timestamp();
    const plan = this.planner.plan({ project, bundle, compatibility, createdAt: timestamp });
    const savedArtifacts = await this.saveDeploymentArtifacts(project, artifacts, [
      this.artifact(project, "theme-deployment/plan.json", plan as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/compatibility.json", compatibility as unknown as Readonly<Record<string, unknown>>, timestamp),
    ]);
    await this.audit(tenant, "DEPLOYMENT_PLAN_CREATED", project.id, "Safe deployment plan created.", input.correlationId, {
      projectId: project.id,
      compatibilityStatus: compatibility.status,
      targetStore: plan.targetStore,
    });
    return { project, plan, compatibility, artifacts: savedArtifacts };
  }

  public async deploy(input: SafeDeployInput, tenant: TenantContext): Promise<SafeDeploymentResult> {
    const project = await this.ensureApproval(await this.getProject(input.projectId, tenant), tenant, input.requestedBy ?? "storefront-api");
    const artifacts = await this.dependencies.storefrontRepository.listArtifacts(project.id);
    await this.audit(tenant, "DEPLOYMENT_STARTED", project.id, "Safe deployment started.", input.correlationId, {
      projectId: project.id,
      gateway: this.dependencies.deploymentGateway?.id ?? "noop-deployment-gateway",
    });
    const timestamp = this.timestamp();
    const bundle = this.getBundle(project.id, artifacts);
    const manifest = this.getManifest(project.id, artifacts);
    const compatibility = this.checker.check({ project, artifacts });
    const validation = this.checker.toValidationReport(compatibility);
    await this.audit(tenant, "DEPLOYMENT_VALIDATED", project.id, "Safe deployment validation completed.", input.correlationId, {
      projectId: project.id,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      compatibilityStatus: compatibility.status,
    });
    const plan = this.planner.plan({ project, bundle, compatibility, createdAt: timestamp });
    const deploymentPackage = this.packageBuilder.build({ project, bundle, manifest, artifacts, plan, createdAt: timestamp });

    if (validation.errors.length > 0) {
      const failedUpload = {
        ok: false,
        gatewayId: this.dependencies.deploymentGateway?.id ?? "noop-deployment-gateway",
        draftThemeId: null,
        previousActiveThemeId: null,
        uploadStatus: "FAILED" as const,
        deploymentReference: `blocked-deployment:${project.id}`,
        warnings: [],
        failureCode: "STOREFRONT_DEPLOYMENT_COMPATIBILITY_FAILED",
        failureMessage: validation.blockedReasons.join("; "),
      };
      const failed = this.deployment(project, "FAILED", failedUpload, compatibility, deploymentPackage, validation, timestamp);
      await this.persistFailedDeployment(project, artifacts, failed, timestamp, input.correlationId, tenant);
      throw AppError.badRequest("Safe deployment validation failed.", {
        projectId: project.id,
        blockedReasons: validation.blockedReasons.join("; "),
      }, "STOREFRONT_DEPLOYMENT_BLOCKED");
    }

    const upload = await this.uploader.upload({ project, deploymentPackage, artifacts });
    const deployment = this.deployment(project, upload.ok ? "READY_FOR_RELEASE" : "FAILED", upload, compatibility, deploymentPackage, validation, timestamp);
    const health = this.healthChecker.check({ deployment, checkedAt: timestamp });
    const rollback = this.rollbackPreparation.prepare({ deployment, createdAt: timestamp });
    const existingHistory = this.getHistory(artifacts).deployments;
    const history = this.historyBuilder.append({ projectId: project.id, existing: existingHistory, deployment });
    const savedArtifacts = await this.saveDeploymentArtifacts(project, artifacts, [
      this.artifact(project, "theme-deployment/plan.json", plan as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/compatibility.json", compatibility as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/package.json", deploymentPackage as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/deployment.json", deployment as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/deployment-history.json", history as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/health.json", health as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/rollback-preparation.json", rollback as unknown as Readonly<Record<string, unknown>>, timestamp),
    ]);
    const updatedProject = await this.dependencies.storefrontRepository.updateProject({
      ...project,
      status: health.readyForRelease ? "READY_FOR_RELEASE" : "FAILED",
      validationSnapshot: validation,
      qualitySnapshot: {
        ...project.qualitySnapshot,
        categoryScores: { ...project.qualitySnapshot.categoryScores, deploymentHealth: health.readyForRelease ? 100 : 20 },
        warnings: project.qualitySnapshot.warnings.concat(health.warnings),
        recommendations: project.qualitySnapshot.recommendations.concat("Review safe deployment metadata before production launch."),
      },
      ...(health.readyForRelease ? {} : {
        failureStage: "SAFE_DEPLOYMENT",
        failureCode: upload.failureCode ?? "STOREFRONT_DEPLOYMENT_FAILED",
        failureMessage: upload.failureMessage ?? health.errors.join("; "),
      }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      updatedAt: timestamp,
      completedAt: timestamp,
    });
    await this.audit(tenant, health.readyForRelease ? "DEPLOYMENT_COMPLETED" : "DEPLOYMENT_FAILED", project.id, health.readyForRelease ? "Safe deployment completed and is ready for release." : "Safe deployment failed.", input.correlationId, {
      projectId: project.id,
      status: updatedProject.status,
      deploymentReference: deployment.deploymentReference,
      readyForRelease: health.readyForRelease,
    });
    await this.audit(tenant, "ROLLBACK_PREPARED", project.id, "Rollback preparation metadata created.", input.correlationId, {
      projectId: project.id,
      rollbackId: rollback.rollbackId,
      previousThemeReference: rollback.previousThemeReference ?? "none",
    });

    return { project: updatedProject, deployment, health, rollback, history, artifacts: savedArtifacts };
  }

  public async getDeployment(projectId: string, tenant: TenantContext): Promise<DeploymentResult> {
    await this.getProject(projectId, tenant);
    return await this.findDeploymentArtifact<DeploymentResult>(projectId, "theme-deployment/deployment.json");
  }

  public async getDeploymentHistory(projectId: string, tenant: TenantContext): Promise<DeploymentHistory> {
    await this.getProject(projectId, tenant);
    return await this.findDeploymentArtifact<DeploymentHistory>(projectId, "theme-deployment/deployment-history.json");
  }

  public async getDeploymentHealth(projectId: string, tenant: TenantContext): Promise<DeploymentHealthReport> {
    await this.getProject(projectId, tenant);
    return await this.findDeploymentArtifact<DeploymentHealthReport>(projectId, "theme-deployment/health.json");
  }

  public verify(input: {
    readonly project: StorefrontProject;
    readonly artifacts: readonly StorefrontArtifact[];
  }): DeploymentReadinessResult {
    const deployment = input.artifacts.find((artifact) => artifact.path === "theme-deployment/deployment.json")?.contentSnapshot as DeploymentResult | undefined;
    const health = input.artifacts.find((artifact) => artifact.path === "theme-deployment/health.json")?.contentSnapshot as DeploymentHealthReport | undefined;
    return this.verifier.verify({
      ...(deployment === undefined ? {} : { deployment }),
      ...(health === undefined ? {} : { health }),
    });
  }

  private async ensureApproval(project: StorefrontProject, tenant: TenantContext, requestedBy: string): Promise<StorefrontProject> {
    if (project.approvalId !== undefined || this.dependencies.approvalRepository === undefined) {
      return project;
    }
    const approvalId = `approval:${project.id}:deployment`;
    await this.dependencies.approvalRepository.save(tenant, {
      ...tenant,
      id: approvalId,
      proposalId: project.id,
      title: `Review safe deployment for ${project.brandName}`,
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
    return this.dependencies.storefrontRepository.updateProject({
      ...project,
      approvalId,
      updatedAt: this.timestamp(),
    });
  }

  private async getProject(projectId: string, tenant: TenantContext): Promise<StorefrontProject> {
    const normalizedProjectId = this.requiredText(projectId, "projectId");
    const project = await this.dependencies.storefrontRepository.findProjectById(normalizedProjectId);
    if (project?.tenantId !== tenant.tenantId || project.storeId !== tenant.storeId) {
      throw AppError.notFound("Storefront project was not found.", { projectId: normalizedProjectId }, "STOREFRONT_PROJECT_NOT_FOUND");
    }
    return project;
  }

  private getBundle(projectId: string, artifacts: readonly StorefrontArtifact[]): ThemeArtifactBundle {
    const artifact = artifacts.find((item) => item.path === "theme-preview/bundle.json");
    if (artifact === undefined) {
      throw AppError.badRequest("Theme artifact preview bundle is required before safe deployment.", { projectId }, "STOREFRONT_ARTIFACT_BUNDLE_REQUIRED");
    }
    return artifact.contentSnapshot as unknown as ThemeArtifactBundle;
  }

  private getManifest(projectId: string, artifacts: readonly StorefrontArtifact[]): Readonly<Record<string, unknown>> {
    const artifact = artifacts.find((item) => item.path === "theme-preview/manifest.json");
    if (artifact === undefined) {
      throw AppError.badRequest("Theme artifact manifest is required before safe deployment.", { projectId }, "STOREFRONT_ARTIFACT_MANIFEST_REQUIRED");
    }
    return artifact.contentSnapshot;
  }

  private getHistory(artifacts: readonly StorefrontArtifact[]): DeploymentHistory {
    const artifact = artifacts.find((item) => item.path === "theme-deployment/deployment-history.json");
    const snapshot = artifact?.contentSnapshot as DeploymentHistory | undefined;
    return snapshot ?? { projectId: "", deployments: [] };
  }

  private deployment(
    project: StorefrontProject,
    status: DeploymentResult["status"],
    upload: DeploymentResult["upload"],
    compatibility: DeploymentResult["compatibility"],
    deploymentPackage: DeploymentResult["deploymentPackage"],
    validation: DeploymentResult["validation"],
    timestamp: string,
  ): DeploymentResult {
    return {
      deploymentId: `deployment:${project.id}:${this.idGenerator()}`,
      projectId: project.id,
      status,
      deploymentReference: upload.deploymentReference,
      draftThemeId: upload.draftThemeId,
      previousActiveThemeId: upload.previousActiveThemeId,
      compatibility,
      deploymentPackage,
      upload,
      validation,
      warnings: compatibility.warnings.concat(upload.warnings),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async persistFailedDeployment(
    project: StorefrontProject,
    artifacts: readonly StorefrontArtifact[],
    deployment: DeploymentResult,
    timestamp: string,
    correlationId: string | undefined,
    tenant: TenantContext,
  ): Promise<void> {
    const health = this.healthChecker.check({ deployment, checkedAt: timestamp });
    await this.saveDeploymentArtifacts(project, artifacts, [
      this.artifact(project, "theme-deployment/deployment.json", deployment as unknown as Readonly<Record<string, unknown>>, timestamp),
      this.artifact(project, "theme-deployment/health.json", health as unknown as Readonly<Record<string, unknown>>, timestamp),
    ]);
    await this.dependencies.storefrontRepository.updateProject({
      ...project,
      status: "FAILED",
      validationSnapshot: deployment.validation,
      failureStage: "SAFE_DEPLOYMENT_VALIDATION",
      failureCode: "STOREFRONT_DEPLOYMENT_BLOCKED",
      failureMessage: deployment.validation.blockedReasons.join("; "),
      updatedAt: timestamp,
      completedAt: timestamp,
    });
    await this.audit(tenant, "DEPLOYMENT_FAILED", project.id, "Safe deployment failed validation.", correlationId, {
      projectId: project.id,
      blockedReasons: deployment.validation.blockedReasons.join("; "),
    });
  }

  private async saveDeploymentArtifacts(
    project: StorefrontProject,
    currentArtifacts: readonly StorefrontArtifact[],
    deploymentArtifacts: readonly StorefrontArtifact[],
  ): Promise<readonly StorefrontArtifact[]> {
    const preserved = currentArtifacts.filter((artifact) => !artifact.path.startsWith("theme-deployment/"));
    return this.dependencies.storefrontRepository.saveArtifacts(project.id, preserved.concat(deploymentArtifacts));
  }

  private async findDeploymentArtifact<TPayload>(projectId: string, path: string): Promise<TPayload> {
    const artifact = (await this.dependencies.storefrontRepository.listArtifacts(projectId)).find((item) => item.path === path);
    if (artifact === undefined) {
      throw AppError.notFound("Deployment artifact was not found.", { projectId, path }, "STOREFRONT_DEPLOYMENT_NOT_FOUND");
    }
    return artifact.contentSnapshot as unknown as TPayload;
  }

  private artifact(project: StorefrontProject, path: string, payload: Readonly<Record<string, unknown>>, timestamp: string): StorefrontArtifact {
    return {
      id: `storefront-artifact:${project.id}:${path.replace(/[^a-z0-9]+/giu, "-")}`,
      storefrontProjectId: project.id,
      artifactType: path.includes("rollback") ? "ROLLBACK_MANIFEST" : "DEPLOYMENT_MANIFEST",
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
      id: `audit:${entityId}:safe-deployment:${this.nextAuditSequence()}:${this.idGenerator()}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "storefront-safe-deployment",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, storefrontEventType, activeSprint: "SACP-03.03E" },
      source: "deterministic-preview",
      sequence: this.auditSequence,
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "storefront.safe-deployment",
      status: storefrontEventType === "DEPLOYMENT_FAILED" ? "BLOCKED" : "READY_FOR_REVIEW",
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
