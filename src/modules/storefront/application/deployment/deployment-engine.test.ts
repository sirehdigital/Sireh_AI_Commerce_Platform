import { describe, expect, it } from "vitest";

import type { StorefrontArtifact, StorefrontProject } from "../../domain/index.js";
import { ArtifactSerializer, type ThemeArtifactBundle } from "../artifacts/index.js";
import {
  DeploymentCompatibilityChecker,
  DeploymentHealthChecker,
  DeploymentPackageBuilder,
  DeploymentPlanner,
  DeploymentVerifier,
  FakeDeploymentGateway,
  NoOpDeploymentGateway,
  RollbackPreparationService,
} from "./index.js";

const timestamp = "2026-07-30T15:00:00.000Z";
const serializer = new ArtifactSerializer();

const project = (): StorefrontProject => ({
  id: "storefront-project:test",
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
  status: "PENDING_REVIEW",
  mode: "PLAN_ONLY",
  brandName: "Lumora Beauty",
  themeTargetReference: "theme-live",
  selectedProductDraftIds: ["draft-1"],
  locale: "en-US",
  markets: ["US"],
  idempotencyKey: "storefront:lumora",
  planSnapshot: {} as StorefrontProject["planSnapshot"],
  validationSnapshot: { errors: [], warnings: [], blockedReasons: [], requiresHumanReview: true },
  qualitySnapshot: { overallScore: 90, categoryScores: {}, errors: [], warnings: [], recommendations: [], requiresHumanReview: true, renderedVisualQuality: "UNKNOWN" },
  approvalId: "approval:storefront-project:test",
  createdAt: timestamp,
  updatedAt: timestamp,
});

const bundle: ThemeArtifactBundle = {
  bundleVersion: "2026-07-30",
  generatedAt: timestamp,
  projectId: "storefront-project:test",
  planningScore: 90,
  mappingScore: 95,
  artifactValidationScore: 100,
  artifactCount: 6,
  manifest: {
    manifestVersion: "2026-07-30",
    projectId: "storefront-project:test",
    artifacts: [],
  },
  bundleHash: "b".repeat(64),
  requiresReview: true,
};

const artifact = (path: string, payload: Readonly<Record<string, unknown>> = {}): StorefrontArtifact => ({
  id: `artifact:${path}`,
  storefrontProjectId: "storefront-project:test",
  artifactType: "DEPLOYMENT_MANIFEST",
  path,
  contentHash: serializer.hash(payload),
  format: "json",
  status: "GENERATED",
  contentSnapshot: payload,
  sourceReferences: ["draft-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
});

const artifacts = (): readonly StorefrontArtifact[] => [
  artifact("theme-preview/homepage.json"),
  artifact("theme-preview/product.json"),
  artifact("theme-preview/sections.json"),
  artifact("theme-preview/assets.json"),
  artifact("theme-preview/manifest.json", bundle.manifest as unknown as Readonly<Record<string, unknown>>),
  artifact("theme-preview/bundle.json", bundle as unknown as Readonly<Record<string, unknown>>),
];

describe("safe deployment engine components", () => {
  it("plans a deterministic PLAN_ONLY deployment", () => {
    const checker = new DeploymentCompatibilityChecker();
    const compatibility = checker.check({ project: project(), artifacts: artifacts() });
    const plan = new DeploymentPlanner().plan({ project: project(), bundle, compatibility, createdAt: timestamp });

    expect(plan).toMatchObject({
      planId: "deployment-plan:storefront-project:test",
      deploymentMode: "PLAN_ONLY",
      compatibilityStatus: "PASSED",
      rollbackReference: "rollback-prep:storefront-project:test",
    });
    expect(plan.checklist).toContain("Production activation is reserved for SACP-03.03F.");
  });

  it("blocks deployment compatibility when required preview artifacts are missing", () => {
    const compatibility = new DeploymentCompatibilityChecker().check({
      project: project(),
      artifacts: [artifact("theme-preview/bundle.json", bundle as unknown as Readonly<Record<string, unknown>>)],
    });

    expect(compatibility.status).toBe("FAILED");
    expect(compatibility.errors.join(" ")).toContain("theme-preview/manifest.json");
  });

  it("builds a package without generating a zip artifact", () => {
    const currentProject = project();
    const compatibility = new DeploymentCompatibilityChecker().check({ project: currentProject, artifacts: artifacts() });
    const plan = new DeploymentPlanner().plan({ project: currentProject, bundle, compatibility, createdAt: timestamp });
    const deploymentPackage = new DeploymentPackageBuilder().build({
      project: currentProject,
      bundle,
      manifest: bundle.manifest as unknown as Readonly<Record<string, unknown>>,
      artifacts: artifacts(),
      plan,
      createdAt: timestamp,
    });

    expect(deploymentPackage.hash).toHaveLength(64);
    expect(deploymentPackage.deploymentSignature).toBe(`sha256:${deploymentPackage.hash}`);
    expect(deploymentPackage.artifactReferences).not.toContain("theme.zip");
  });

  it("keeps NoOp and Fake gateways behind the same upload contract", () => {
    const currentProject = project();
    const compatibility = new DeploymentCompatibilityChecker().check({ project: currentProject, artifacts: artifacts() });
    const plan = new DeploymentPlanner().plan({ project: currentProject, bundle, compatibility, createdAt: timestamp });
    const deploymentPackage = new DeploymentPackageBuilder().build({
      project: currentProject,
      bundle,
      manifest: bundle.manifest as unknown as Readonly<Record<string, unknown>>,
      artifacts: artifacts(),
      plan,
      createdAt: timestamp,
    });

    const noop = new NoOpDeploymentGateway().uploadDraftTheme({ project: currentProject, deploymentPackage, artifacts: artifacts() });
    const fake = new FakeDeploymentGateway();
    const fakeResult = fake.uploadDraftTheme({ project: currentProject, deploymentPackage, artifacts: artifacts() });

    expect(noop.uploadStatus).toBe("SKIPPED_NOOP");
    expect(fakeResult.uploadStatus).toBe("UPLOADED_DRAFT");
    expect(fake.uploadCount).toBe(1);
  });

  it("verifies health and rollback preparation for a ready deployment", () => {
    const currentProject = project();
    const compatibility = new DeploymentCompatibilityChecker().check({ project: currentProject, artifacts: artifacts() });
    const plan = new DeploymentPlanner().plan({ project: currentProject, bundle, compatibility, createdAt: timestamp });
    const deploymentPackage = new DeploymentPackageBuilder().build({
      project: currentProject,
      bundle,
      manifest: bundle.manifest as unknown as Readonly<Record<string, unknown>>,
      artifacts: artifacts(),
      plan,
      createdAt: timestamp,
    });
    const upload = new NoOpDeploymentGateway().uploadDraftTheme({ project: currentProject, deploymentPackage, artifacts: artifacts() });
    const deployment = {
      deploymentId: "deployment:test",
      projectId: currentProject.id,
      status: "READY_FOR_RELEASE" as const,
      deploymentReference: upload.deploymentReference,
      draftThemeId: upload.draftThemeId,
      previousActiveThemeId: upload.previousActiveThemeId,
      compatibility,
      deploymentPackage,
      upload,
      validation: { errors: [], warnings: [], blockedReasons: [], requiresHumanReview: true },
      warnings: upload.warnings,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const health = new DeploymentHealthChecker().check({ deployment, checkedAt: timestamp });
    const rollback = new RollbackPreparationService().prepare({ deployment, createdAt: timestamp });
    const readiness = new DeploymentVerifier().verify({ deployment, health });

    expect(health.readyForRelease).toBe(true);
    expect(rollback.validation.errors).toHaveLength(0);
    expect(readiness).toMatchObject({ ok: true, compatibilityPassed: true, validationPassed: true });
  });
});
