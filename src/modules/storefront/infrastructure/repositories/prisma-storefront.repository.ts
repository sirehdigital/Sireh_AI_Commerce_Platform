import { prisma } from "../../../../database/prisma/prisma.client.js";
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

interface StoredStorefrontProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly version: number;
  readonly brandName: string;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface StoredStorefrontProject {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly status: string;
  readonly mode: string;
  readonly brandName: string;
  readonly themeTargetReference: string;
  readonly selectedProductDraftIds: unknown;
  readonly locale: string;
  readonly markets: unknown;
  readonly idempotencyKey: string;
  readonly planSnapshot: unknown;
  readonly validationSnapshot: unknown;
  readonly qualitySnapshot: unknown;
  readonly approvalId: string | null;
  readonly correlationId: string | null;
  readonly parentProjectId: string | null;
  readonly failureStage: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

interface StoredStorefrontArtifact {
  readonly id: string;
  readonly storefrontProjectId: string;
  readonly artifactType: string;
  readonly path: string;
  readonly contentHash: string;
  readonly format: string;
  readonly status: string;
  readonly contentSnapshot: unknown;
  readonly sourceReferences: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface StoredStorefrontPreview {
  readonly id: string;
  readonly storefrontProjectId: string;
  readonly planSnapshot: unknown;
  readonly generatedArtifactReferences: unknown;
  readonly themeTarget: unknown;
  readonly selectedProductDraftIds: unknown;
  readonly qualityReport: unknown;
  readonly validationReport: unknown;
  readonly previewStatus: string;
  readonly previewUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface Delegate<TStored> {
  readonly create: (args: unknown) => Promise<TStored>;
  readonly update?: (args: unknown) => Promise<TStored>;
  readonly findFirst: (args: unknown) => Promise<TStored | null>;
  readonly findUnique: (args: unknown) => Promise<TStored | null>;
  readonly findMany: (args: unknown) => Promise<readonly TStored[]>;
  readonly count: (args: unknown) => Promise<number>;
  readonly deleteMany?: (args: unknown) => Promise<unknown>;
}

const storefrontPrisma = prisma as unknown as {
  readonly storefrontProfile: Delegate<StoredStorefrontProfile>;
  readonly storefrontProject: Delegate<StoredStorefrontProject>;
  readonly storefrontArtifact: Delegate<StoredStorefrontArtifact>;
  readonly storefrontPreview: Delegate<StoredStorefrontPreview>;
};

export class PrismaStorefrontRepository implements StorefrontRepository {
  public constructor(
    private readonly profileDelegate: Delegate<StoredStorefrontProfile>,
    private readonly projectDelegate: Delegate<StoredStorefrontProject>,
    private readonly artifactDelegate: Delegate<StoredStorefrontArtifact>,
    private readonly previewDelegate: Delegate<StoredStorefrontPreview>,
  ) {}

  public async saveProfile(profile: StorefrontProfile): Promise<StorefrontProfile> {
    const stored = await this.profileDelegate.create({ data: this.toProfileData(profile) });
    return this.toProfile(stored);
  }

  public async findProfile(input: { readonly tenantId: string; readonly storeId: string; readonly profileId?: string }): Promise<StorefrontProfile | undefined> {
    const stored = await this.profileDelegate.findFirst({
      where: {
        tenantId: input.tenantId,
        storeId: input.storeId,
        ...(input.profileId === undefined ? {} : { id: input.profileId }),
      },
      orderBy: [{ updatedAt: "desc" }],
    });
    return stored === null ? undefined : this.toProfile(stored);
  }

  public async listProfiles(query: StorefrontProfileListQuery = {}): Promise<StorefrontProfileListResult> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = {
      ...(query.tenantId === undefined ? {} : { tenantId: query.tenantId }),
      ...(query.storeId === undefined ? {} : { storeId: query.storeId }),
    };
    const [total, profiles] = await Promise.all([
      this.profileDelegate.count({ where }),
      this.profileDelegate.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: offset, take: limit }),
    ]);
    const nextOffset = offset + profiles.length;
    return {
      items: profiles.map((profile) => this.toProfile(profile)),
      total,
      limit,
      offset,
      hasNextPage: nextOffset < total,
      ...(nextOffset < total ? { nextOffset } : {}),
    };
  }

  public async createProject(project: StorefrontProject): Promise<StorefrontProject> {
    const stored = await this.projectDelegate.create({ data: this.toProjectData(project) });
    return this.toProject(stored);
  }

  public async updateProject(project: StorefrontProject): Promise<StorefrontProject> {
    if (this.projectDelegate.update === undefined) {
      return project;
    }
    const stored = await this.projectDelegate.update({ where: { id: project.id }, data: this.toProjectData(project) });
    return this.toProject(stored);
  }

  public async findProjectById(projectId: string): Promise<StorefrontProject | undefined> {
    const stored = await this.projectDelegate.findUnique({ where: { id: projectId } });
    return stored === null ? undefined : this.toProject(stored);
  }

  public async findProjectByIdempotencyKey(input: {
    readonly tenantId: string;
    readonly storeId: string;
    readonly idempotencyKey: string;
  }): Promise<StorefrontProject | undefined> {
    const stored = await this.projectDelegate.findFirst({
      where: {
        tenantId: input.tenantId,
        storeId: input.storeId,
        idempotencyKey: input.idempotencyKey,
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return stored === null ? undefined : this.toProject(stored);
  }

  public async listProjects(query: StorefrontProjectListQuery = {}): Promise<StorefrontProjectListResult> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = {
      ...(query.tenantId === undefined ? {} : { tenantId: query.tenantId }),
      ...(query.storeId === undefined ? {} : { storeId: query.storeId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.locale === undefined ? {} : { locale: query.locale }),
    };
    const [total, projects] = await Promise.all([
      this.projectDelegate.count({ where }),
      this.projectDelegate.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: offset, take: limit }),
    ]);
    const nextOffset = offset + projects.length;
    return {
      items: projects.map((project) => this.toProject(project)),
      total,
      limit,
      offset,
      hasNextPage: nextOffset < total,
      ...(nextOffset < total ? { nextOffset } : {}),
    };
  }

  public async saveArtifacts(projectId: string, artifacts: readonly StorefrontArtifact[]): Promise<readonly StorefrontArtifact[]> {
    await this.artifactDelegate.deleteMany?.({ where: { storefrontProjectId: projectId } });
    const saved = await Promise.all(artifacts.map((artifact) => this.artifactDelegate.create({ data: this.toArtifactData(artifact) })));
    return saved.map((artifact) => this.toArtifact(artifact));
  }

  public async listArtifacts(projectId: string): Promise<readonly StorefrontArtifact[]> {
    const artifacts = await this.artifactDelegate.findMany({ where: { storefrontProjectId: projectId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return artifacts.map((artifact) => this.toArtifact(artifact));
  }

  public async savePreview(preview: StorefrontPreview): Promise<StorefrontPreview> {
    const stored = await this.previewDelegate.create({ data: this.toPreviewData(preview) });
    return this.toPreview(stored);
  }

  public async findPreviewByProjectId(projectId: string): Promise<StorefrontPreview | undefined> {
    const stored = await this.previewDelegate.findFirst({ where: { storefrontProjectId: projectId }, orderBy: [{ createdAt: "desc" }] });
    return stored === null ? undefined : this.toPreview(stored);
  }

  private toProfileData(profile: StorefrontProfile): Record<string, unknown> {
    return {
      id: profile.id,
      tenantId: profile.tenantId,
      storeId: profile.storeId,
      shopDomain: profile.shopDomain ?? null,
      version: profile.version,
      brandName: profile.brandName,
      payload: this.clone(profile),
      createdAt: new Date(profile.createdAt),
      updatedAt: new Date(profile.updatedAt),
    };
  }

  private toProjectData(project: StorefrontProject): Record<string, unknown> {
    return {
      id: project.id,
      tenantId: project.tenantId,
      storeId: project.storeId,
      shopDomain: project.shopDomain ?? null,
      status: project.status,
      mode: project.mode,
      brandName: project.brandName,
      themeTargetReference: project.themeTargetReference,
      selectedProductDraftIds: [...project.selectedProductDraftIds],
      locale: project.locale,
      markets: [...project.markets],
      idempotencyKey: project.idempotencyKey,
      planSnapshot: this.clone(project.planSnapshot),
      validationSnapshot: this.clone(project.validationSnapshot),
      qualitySnapshot: this.clone(project.qualitySnapshot),
      approvalId: project.approvalId ?? null,
      correlationId: project.correlationId ?? null,
      parentProjectId: project.parentProjectId ?? null,
      failureStage: project.failureStage ?? null,
      failureCode: project.failureCode ?? null,
      failureMessage: project.failureMessage ?? null,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
      completedAt: project.completedAt === undefined ? null : new Date(project.completedAt),
    };
  }

  private toArtifactData(artifact: StorefrontArtifact): Record<string, unknown> {
    return {
      id: artifact.id,
      storefrontProjectId: artifact.storefrontProjectId,
      artifactType: artifact.artifactType,
      path: artifact.path,
      contentHash: artifact.contentHash,
      format: artifact.format,
      status: artifact.status,
      contentSnapshot: this.clone(artifact.contentSnapshot),
      sourceReferences: [...artifact.sourceReferences],
      createdAt: new Date(artifact.createdAt),
      updatedAt: new Date(artifact.updatedAt),
    };
  }

  private toPreviewData(preview: StorefrontPreview): Record<string, unknown> {
    return {
      id: preview.id,
      storefrontProjectId: preview.storefrontProjectId,
      planSnapshot: this.clone(preview.planSnapshot),
      generatedArtifactReferences: [...preview.generatedArtifactReferences],
      themeTarget: this.clone(preview.themeTarget),
      selectedProductDraftIds: [...preview.selectedProductDraftIds],
      qualityReport: this.clone(preview.qualityReport),
      validationReport: this.clone(preview.validationReport),
      previewStatus: preview.previewStatus,
      previewUrl: preview.previewUrl,
      createdAt: new Date(preview.createdAt),
      updatedAt: new Date(preview.updatedAt),
    };
  }

  private toProfile(stored: StoredStorefrontProfile): StorefrontProfile {
    return this.clone(stored.payload) as StorefrontProfile;
  }

  private toProject(stored: StoredStorefrontProject): StorefrontProject {
    return {
      id: stored.id,
      tenantId: stored.tenantId,
      storeId: stored.storeId,
      ...(stored.shopDomain === null ? {} : { shopDomain: stored.shopDomain as `${string}.myshopify.com` }),
      status: stored.status as StorefrontProject["status"],
      mode: stored.mode as StorefrontProject["mode"],
      brandName: stored.brandName,
      themeTargetReference: stored.themeTargetReference,
      selectedProductDraftIds: this.clone(stored.selectedProductDraftIds) as readonly string[],
      locale: stored.locale,
      markets: this.clone(stored.markets) as readonly string[],
      idempotencyKey: stored.idempotencyKey,
      planSnapshot: this.clone(stored.planSnapshot) as StorefrontProject["planSnapshot"],
      validationSnapshot: this.clone(stored.validationSnapshot) as StorefrontProject["validationSnapshot"],
      qualitySnapshot: this.clone(stored.qualitySnapshot) as StorefrontProject["qualitySnapshot"],
      ...(stored.approvalId === null ? {} : { approvalId: stored.approvalId }),
      ...(stored.correlationId === null ? {} : { correlationId: stored.correlationId }),
      ...(stored.parentProjectId === null ? {} : { parentProjectId: stored.parentProjectId }),
      ...(stored.failureStage === null ? {} : { failureStage: stored.failureStage }),
      ...(stored.failureCode === null ? {} : { failureCode: stored.failureCode }),
      ...(stored.failureMessage === null ? {} : { failureMessage: stored.failureMessage }),
      createdAt: stored.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
      ...(stored.completedAt === null ? {} : { completedAt: stored.completedAt.toISOString() }),
    };
  }

  private toArtifact(stored: StoredStorefrontArtifact): StorefrontArtifact {
    return {
      id: stored.id,
      storefrontProjectId: stored.storefrontProjectId,
      artifactType: stored.artifactType as StorefrontArtifact["artifactType"],
      path: stored.path,
      contentHash: stored.contentHash,
      format: stored.format as StorefrontArtifact["format"],
      status: stored.status as StorefrontArtifact["status"],
      contentSnapshot: this.clone(stored.contentSnapshot) as StorefrontArtifact["contentSnapshot"],
      sourceReferences: this.clone(stored.sourceReferences) as readonly string[],
      createdAt: stored.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
    };
  }

  private toPreview(stored: StoredStorefrontPreview): StorefrontPreview {
    return {
      id: stored.id,
      storefrontProjectId: stored.storefrontProjectId,
      planSnapshot: this.clone(stored.planSnapshot) as StorefrontPreview["planSnapshot"],
      generatedArtifactReferences: this.clone(stored.generatedArtifactReferences) as readonly string[],
      themeTarget: this.clone(stored.themeTarget) as StorefrontPreview["themeTarget"],
      selectedProductDraftIds: this.clone(stored.selectedProductDraftIds) as readonly string[],
      qualityReport: this.clone(stored.qualityReport) as StorefrontPreview["qualityReport"],
      validationReport: this.clone(stored.validationReport) as StorefrontPreview["validationReport"],
      previewStatus: stored.previewStatus as StorefrontPreview["previewStatus"],
      previewUrl: stored.previewUrl,
      createdAt: stored.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
    };
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export const prismaStorefrontRepository = new PrismaStorefrontRepository(
  storefrontPrisma.storefrontProfile,
  storefrontPrisma.storefrontProject,
  storefrontPrisma.storefrontArtifact,
  storefrontPrisma.storefrontPreview,
);
