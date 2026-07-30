import type {
  StorefrontArtifact,
  StorefrontPreview,
  StorefrontProfile,
  StorefrontProfileListQuery,
  StorefrontProfileListResult,
  StorefrontProject,
  StorefrontProjectListQuery,
  StorefrontProjectListResult,
} from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";

export class InMemoryStorefrontRepository implements StorefrontRepository {
  private readonly profiles = new Map<string, StorefrontProfile>();
  private readonly projects = new Map<string, StorefrontProject>();
  private readonly artifacts = new Map<string, readonly StorefrontArtifact[]>();
  private readonly previews = new Map<string, StorefrontPreview>();

  public saveProfile(profile: StorefrontProfile): Promise<StorefrontProfile> {
    this.profiles.set(profile.id, clone(profile));
    return Promise.resolve(clone(profile));
  }

  public findProfile(input: { readonly tenantId: string; readonly storeId: string; readonly profileId?: string }): Promise<StorefrontProfile | undefined> {
    const profiles = [...this.profiles.values()].filter((profile) =>
      profile.tenantId === input.tenantId &&
      profile.storeId === input.storeId &&
      (input.profileId === undefined || profile.id === input.profileId),
    );
    return Promise.resolve(cloneOptional(profiles[0]));
  }

  public listProfiles(query: StorefrontProfileListQuery = {}): Promise<StorefrontProfileListResult> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const filtered = [...this.profiles.values()]
      .filter((profile) => query.tenantId === undefined || profile.tenantId === query.tenantId)
      .filter((profile) => query.storeId === undefined || profile.storeId === query.storeId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const items = filtered.slice(offset, offset + limit).map((profile) => clone(profile));
    const nextOffset = offset + items.length;
    return Promise.resolve({
      items,
      total: filtered.length,
      limit,
      offset,
      hasNextPage: nextOffset < filtered.length,
      ...(nextOffset < filtered.length ? { nextOffset } : {}),
    });
  }

  public createProject(project: StorefrontProject): Promise<StorefrontProject> {
    this.projects.set(project.id, clone(project));
    return Promise.resolve(clone(project));
  }

  public updateProject(project: StorefrontProject): Promise<StorefrontProject> {
    this.projects.set(project.id, clone(project));
    return Promise.resolve(clone(project));
  }

  public findProjectById(projectId: string): Promise<StorefrontProject | undefined> {
    return Promise.resolve(cloneOptional(this.projects.get(projectId)));
  }

  public findProjectByIdempotencyKey(input: {
    readonly tenantId: string;
    readonly storeId: string;
    readonly idempotencyKey: string;
  }): Promise<StorefrontProject | undefined> {
    return Promise.resolve(cloneOptional([...this.projects.values()].find((project) =>
      project.tenantId === input.tenantId &&
      project.storeId === input.storeId &&
      project.idempotencyKey === input.idempotencyKey,
    )));
  }

  public listProjects(query: StorefrontProjectListQuery = {}): Promise<StorefrontProjectListResult> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const filtered = [...this.projects.values()]
      .filter((project) => query.tenantId === undefined || project.tenantId === query.tenantId)
      .filter((project) => query.storeId === undefined || project.storeId === query.storeId)
      .filter((project) => query.status === undefined || project.status === query.status)
      .filter((project) => query.locale === undefined || project.locale === query.locale)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const items = filtered.slice(offset, offset + limit).map((project) => clone(project));
    const nextOffset = offset + items.length;
    return Promise.resolve({
      items,
      total: filtered.length,
      limit,
      offset,
      hasNextPage: nextOffset < filtered.length,
      ...(nextOffset < filtered.length ? { nextOffset } : {}),
    });
  }

  public saveArtifacts(projectId: string, artifacts: readonly StorefrontArtifact[]): Promise<readonly StorefrontArtifact[]> {
    this.artifacts.set(projectId, artifacts.map((artifact) => clone(artifact)));
    return Promise.resolve(artifacts.map((artifact) => clone(artifact)));
  }

  public listArtifacts(projectId: string): Promise<readonly StorefrontArtifact[]> {
    return Promise.resolve((this.artifacts.get(projectId) ?? []).map((artifact) => clone(artifact)));
  }

  public savePreview(preview: StorefrontPreview): Promise<StorefrontPreview> {
    this.previews.set(preview.storefrontProjectId, clone(preview));
    return Promise.resolve(clone(preview));
  }

  public findPreviewByProjectId(projectId: string): Promise<StorefrontPreview | undefined> {
    return Promise.resolve(cloneOptional(this.previews.get(projectId)));
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}
