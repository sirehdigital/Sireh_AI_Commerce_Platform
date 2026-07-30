import type {
  StorefrontArtifact,
  StorefrontPreview,
  StorefrontProfile,
  StorefrontProfileListQuery,
  StorefrontProfileListResult,
  StorefrontProject,
  StorefrontProjectListQuery,
  StorefrontProjectListResult,
} from "../models/index.js";

export interface StorefrontRepository {
  saveProfile(profile: StorefrontProfile): Promise<StorefrontProfile>;
  findProfile(input: { readonly tenantId: string; readonly storeId: string; readonly profileId?: string }): Promise<StorefrontProfile | undefined>;
  listProfiles(query?: StorefrontProfileListQuery): Promise<StorefrontProfileListResult>;
  createProject(project: StorefrontProject): Promise<StorefrontProject>;
  updateProject(project: StorefrontProject): Promise<StorefrontProject>;
  findProjectById(projectId: string): Promise<StorefrontProject | undefined>;
  findProjectByIdempotencyKey(input: { readonly tenantId: string; readonly storeId: string; readonly idempotencyKey: string }): Promise<StorefrontProject | undefined>;
  listProjects(query?: StorefrontProjectListQuery): Promise<StorefrontProjectListResult>;
  saveArtifacts(projectId: string, artifacts: readonly StorefrontArtifact[]): Promise<readonly StorefrontArtifact[]>;
  listArtifacts(projectId: string): Promise<readonly StorefrontArtifact[]>;
  savePreview(preview: StorefrontPreview): Promise<StorefrontPreview>;
  findPreviewByProjectId(projectId: string): Promise<StorefrontPreview | undefined>;
}
