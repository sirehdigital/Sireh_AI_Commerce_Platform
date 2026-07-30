import type { StorefrontArtifact, StorefrontProject } from "../../domain/index.js";
import { ArtifactSerializer, type ThemeArtifactBundle } from "../artifacts/index.js";
import type { DeploymentPackage, DeploymentPlan } from "./deployment.types.js";

export class DeploymentPackageBuilder {
  private readonly serializer = new ArtifactSerializer();

  public build(input: {
    readonly project: StorefrontProject;
    readonly bundle: ThemeArtifactBundle;
    readonly manifest: Readonly<Record<string, unknown>>;
    readonly artifacts: readonly StorefrontArtifact[];
    readonly plan: DeploymentPlan;
    readonly createdAt: string;
  }): DeploymentPackage {
    const artifactReferences = input.artifacts
      .filter((artifact) => artifact.path.startsWith("theme-preview/"))
      .map((artifact) => artifact.path)
      .sort();
    const seed = {
      projectId: input.project.id,
      version: input.plan.themeVersion,
      bundleHash: input.bundle.bundleHash,
      artifactReferences,
    };
    const hash = this.serializer.hash(seed);
    return {
      packageId: `deployment-package:${input.project.id}`,
      projectId: input.project.id,
      version: input.plan.themeVersion,
      bundleMetadata: {
        bundleVersion: input.bundle.bundleVersion,
        bundleHash: input.bundle.bundleHash,
        artifactCount: input.bundle.artifactCount,
        requiresReview: input.bundle.requiresReview,
      },
      themeMetadata: {
        brandName: input.project.brandName,
        targetStore: input.project.shopDomain ?? input.project.storeId,
        themeTargetReference: input.project.themeTargetReference,
      },
      manifest: input.manifest,
      artifactReferences,
      hash,
      deploymentSignature: `sha256:${hash}`,
      createdAt: input.createdAt,
    };
  }
}

