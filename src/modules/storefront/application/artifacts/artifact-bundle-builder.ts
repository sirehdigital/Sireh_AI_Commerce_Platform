import { ArtifactSerializer } from "./artifact-serializer.js";
import type {
  ManifestIndexPayload,
  SerializedThemeArtifact,
  ThemeArtifactBundle,
} from "./theme-artifact.types.js";

export class ArtifactBundleBuilder {
  private readonly serializer = new ArtifactSerializer();

  public manifest(input: {
    readonly projectId: string;
    readonly artifacts: readonly SerializedThemeArtifact[];
  }): ManifestIndexPayload {
    return {
      manifestVersion: "2026-07-30",
      projectId: input.projectId,
      artifacts: input.artifacts.map((artifact) => ({
        kind: artifact.kind,
        path: artifact.path,
        contentHash: artifact.contentHash,
      })),
    };
  }

  public bundle(input: {
    readonly generatedAt: string;
    readonly projectId: string;
    readonly planningScore: number;
    readonly mappingScore: number;
    readonly artifactValidationScore: number;
    readonly artifactCount: number;
    readonly manifest: ManifestIndexPayload;
    readonly requiresReview: boolean;
  }): ThemeArtifactBundle {
    const hashInput = {
      bundleVersion: "2026-07-30",
      projectId: input.projectId,
      planningScore: input.planningScore,
      mappingScore: input.mappingScore,
      artifactValidationScore: input.artifactValidationScore,
      artifactCount: input.artifactCount,
      manifest: input.manifest,
    };
    return {
      bundleVersion: "2026-07-30",
      generatedAt: input.generatedAt,
      projectId: input.projectId,
      planningScore: input.planningScore,
      mappingScore: input.mappingScore,
      artifactValidationScore: input.artifactValidationScore,
      artifactCount: input.artifactCount,
      manifest: input.manifest,
      bundleHash: this.serializer.hash(hashInput),
      requiresReview: input.requiresReview,
    };
  }
}
