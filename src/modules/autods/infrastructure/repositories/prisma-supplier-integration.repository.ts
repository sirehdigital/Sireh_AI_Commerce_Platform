import { prisma } from "../../../../database/prisma/prisma.client.js";
import type {
  AutoDSConnection,
  SupplierHealth,
  SupplierImportJob,
  SupplierProductReference,
  SupplierSyncJob,
} from "../../domain/models/supplier-integration.model.js";
import type {
  SupplierConnectionIdentity,
  SupplierIntegrationRepository,
  SupplierJobListQuery,
  SupplierJobListResult,
} from "../../domain/repositories/supplier-integration.repository.js";

interface StoredSupplierConnection {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly supplierProvider: string;
  readonly status: string;
  readonly credentialsReference: unknown;
  readonly capabilities: unknown;
  readonly healthSnapshot: unknown;
  readonly connectedAt: Date | null;
  readonly disconnectedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface StoredSupplierImportJob {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly supplierProvider: string;
  readonly status: string;
  readonly idempotencyKey: string;
  readonly requestedBy: string;
  readonly force: boolean;
  readonly productReferenceIds: unknown;
  readonly productImportIds: unknown;
  readonly warnings: unknown;
  readonly failure: unknown;
  readonly auditReference: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

interface StoredSupplierSyncJob {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly supplierProvider: string;
  readonly syncType: string;
  readonly status: string;
  readonly idempotencyKey: string;
  readonly productReferenceIds: unknown;
  readonly warnings: unknown;
  readonly failure: unknown;
  readonly auditReference: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

interface StoredSupplierProductReference {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly supplierProvider: string;
  readonly externalProductId: string;
  readonly title: string;
  readonly brand: string | null;
  readonly category: string | null;
  readonly productType: string | null;
  readonly inventorySnapshot: unknown;
  readonly pricingSnapshot: unknown;
  readonly mediaReferences: unknown;
  readonly shippingProfile: unknown;
  readonly rawPayload: unknown;
  readonly lastSyncedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface SupplierDelegate<TStored> {
  readonly create: (args: unknown) => Promise<TStored>;
  readonly update: (args: unknown) => Promise<TStored>;
  readonly findUnique: (args: unknown) => Promise<TStored | null>;
  readonly findFirst: (args: unknown) => Promise<TStored | null>;
  readonly findMany: (args: unknown) => Promise<readonly TStored[]>;
  readonly count: (args: unknown) => Promise<number>;
}

const supplierPrisma = prisma as unknown as {
  readonly supplierConnection: SupplierDelegate<StoredSupplierConnection>;
  readonly supplierImportJob: SupplierDelegate<StoredSupplierImportJob>;
  readonly supplierSyncJob: SupplierDelegate<StoredSupplierSyncJob>;
  readonly supplierProductReference: SupplierDelegate<StoredSupplierProductReference>;
};

export class PrismaSupplierIntegrationRepository implements SupplierIntegrationRepository {
  public constructor(
    private readonly connectionDelegate: SupplierDelegate<StoredSupplierConnection>,
    private readonly importJobDelegate: SupplierDelegate<StoredSupplierImportJob>,
    private readonly syncJobDelegate: SupplierDelegate<StoredSupplierSyncJob>,
    private readonly productReferenceDelegate: SupplierDelegate<StoredSupplierProductReference>,
  ) {}

  public async findConnection(identity: SupplierConnectionIdentity): Promise<AutoDSConnection | undefined> {
    const stored = await this.connectionDelegate.findFirst({ where: identity });
    return stored === null ? undefined : this.toConnection(stored);
  }

  public async saveConnection(connection: AutoDSConnection): Promise<AutoDSConnection> {
    const existing = await this.findConnection(connection);
    const data = this.toConnectionData(connection);
    const stored = existing === undefined
      ? await this.connectionDelegate.create({ data })
      : await this.connectionDelegate.update({ where: { id: existing.id }, data });
    return this.toConnection(stored);
  }

  public async saveProductReference(reference: SupplierProductReference): Promise<SupplierProductReference> {
    const existing = await this.findProductReference(reference);
    const data = this.toProductReferenceData(reference);
    const stored = existing === undefined
      ? await this.productReferenceDelegate.create({ data })
      : await this.productReferenceDelegate.update({ where: { id: existing.id }, data });
    return this.toProductReference(stored);
  }

  public async findProductReference(
    identity: SupplierConnectionIdentity & { readonly externalProductId: string },
  ): Promise<SupplierProductReference | undefined> {
    const stored = await this.productReferenceDelegate.findFirst({ where: identity });
    return stored === null ? undefined : this.toProductReference(stored);
  }

  public async createImportJob(job: SupplierImportJob): Promise<SupplierImportJob> {
    const stored = await this.importJobDelegate.create({ data: this.toImportJobData(job) });
    return this.toImportJob(stored);
  }

  public async updateImportJob(job: SupplierImportJob): Promise<SupplierImportJob> {
    const stored = await this.importJobDelegate.update({ where: { id: job.id }, data: this.toImportJobData(job) });
    return this.toImportJob(stored);
  }

  public async findImportJobById(jobId: string): Promise<SupplierImportJob | undefined> {
    const stored = await this.importJobDelegate.findUnique({ where: { id: jobId } });
    return stored === null ? undefined : this.toImportJob(stored);
  }

  public async findImportJobByIdempotencyKey(idempotencyKey: string): Promise<SupplierImportJob | undefined> {
    const stored = await this.importJobDelegate.findFirst({ where: { idempotencyKey }, orderBy: [{ createdAt: "desc" }] });
    return stored === null ? undefined : this.toImportJob(stored);
  }

  public async listImportJobs(query: SupplierJobListQuery = {}): Promise<SupplierJobListResult<SupplierImportJob>> {
    return this.listJobs(this.importJobDelegate, query, (stored) => this.toImportJob(stored));
  }

  public async createSyncJob(job: SupplierSyncJob): Promise<SupplierSyncJob> {
    const stored = await this.syncJobDelegate.create({ data: this.toSyncJobData(job) });
    return this.toSyncJob(stored);
  }

  public async updateSyncJob(job: SupplierSyncJob): Promise<SupplierSyncJob> {
    const stored = await this.syncJobDelegate.update({ where: { id: job.id }, data: this.toSyncJobData(job) });
    return this.toSyncJob(stored);
  }

  public async findSyncJobById(jobId: string): Promise<SupplierSyncJob | undefined> {
    const stored = await this.syncJobDelegate.findUnique({ where: { id: jobId } });
    return stored === null ? undefined : this.toSyncJob(stored);
  }

  public async findSyncJobByIdempotencyKey(idempotencyKey: string): Promise<SupplierSyncJob | undefined> {
    const stored = await this.syncJobDelegate.findFirst({ where: { idempotencyKey }, orderBy: [{ createdAt: "desc" }] });
    return stored === null ? undefined : this.toSyncJob(stored);
  }

  public async listSyncJobs(query: SupplierJobListQuery = {}): Promise<SupplierJobListResult<SupplierSyncJob>> {
    return this.listJobs(this.syncJobDelegate, query, (stored) => this.toSyncJob(stored));
  }

  private async listJobs<TStored, TJob>(
    delegate: SupplierDelegate<TStored>,
    query: SupplierJobListQuery,
    mapper: (stored: TStored) => TJob,
  ): Promise<SupplierJobListResult<TJob>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = {
      ...(query.tenantId === undefined ? {} : { tenantId: query.tenantId }),
      ...(query.storeId === undefined ? {} : { storeId: query.storeId }),
      ...(query.supplierProvider === undefined ? {} : { supplierProvider: query.supplierProvider }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };
    const [total, items] = await Promise.all([
      delegate.count({ where }),
      delegate.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: offset, take: limit }),
    ]);
    const nextOffset = offset + items.length;
    return {
      items: items.map(mapper),
      total,
      limit,
      offset,
      hasNextPage: nextOffset < total,
      ...(nextOffset < total ? { nextOffset } : {}),
    };
  }

  private toConnectionData(connection: AutoDSConnection): Record<string, unknown> {
    return {
      id: connection.id,
      tenantId: connection.tenantId,
      storeId: connection.storeId,
      shopDomain: connection.shopDomain ?? null,
      supplierProvider: connection.supplierProvider,
      status: connection.status,
      credentialsReference: connection.credentialsReference ?? null,
      capabilities: [...connection.capabilities],
      healthSnapshot: this.clone(connection.health),
      connectedAt: connection.connectedAt === undefined ? null : new Date(connection.connectedAt),
      disconnectedAt: connection.disconnectedAt === undefined ? null : new Date(connection.disconnectedAt),
      createdAt: new Date(connection.createdAt),
      updatedAt: new Date(connection.updatedAt),
    };
  }

  private toImportJobData(job: SupplierImportJob): Record<string, unknown> {
    return {
      id: job.id,
      tenantId: job.tenantId,
      storeId: job.storeId,
      shopDomain: job.shopDomain ?? null,
      supplierProvider: job.supplierProvider,
      status: job.status,
      idempotencyKey: job.idempotencyKey,
      requestedBy: job.requestedBy,
      force: job.force,
      productReferenceIds: [...job.productReferenceIds],
      productImportIds: [...job.productImportIds],
      warnings: [...job.warnings],
      failure: job.failure ?? null,
      auditReference: job.auditReference ?? null,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
      completedAt: job.completedAt === undefined ? null : new Date(job.completedAt),
    };
  }

  private toSyncJobData(job: SupplierSyncJob): Record<string, unknown> {
    return {
      id: job.id,
      tenantId: job.tenantId,
      storeId: job.storeId,
      shopDomain: job.shopDomain ?? null,
      supplierProvider: job.supplierProvider,
      syncType: job.syncType,
      status: job.status,
      idempotencyKey: job.idempotencyKey,
      productReferenceIds: [...job.productReferenceIds],
      warnings: [...job.warnings],
      failure: job.failure ?? null,
      auditReference: job.auditReference ?? null,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
      completedAt: job.completedAt === undefined ? null : new Date(job.completedAt),
    };
  }

  private toProductReferenceData(reference: SupplierProductReference): Record<string, unknown> {
    return {
      id: reference.id,
      tenantId: reference.tenantId,
      storeId: reference.storeId,
      shopDomain: reference.shopDomain ?? null,
      supplierProvider: reference.supplierProvider,
      externalProductId: reference.externalProductId,
      title: reference.title,
      brand: reference.brand ?? null,
      category: reference.category ?? null,
      productType: reference.productType ?? null,
      inventorySnapshot: reference.inventorySnapshot ?? null,
      pricingSnapshot: this.clone(reference.pricingSnapshot),
      mediaReferences: this.clone(reference.mediaReferences),
      shippingProfile: this.clone(reference.shippingProfile),
      rawPayload: reference.rawPayload ?? null,
      lastSyncedAt: reference.lastSyncedAt === undefined ? null : new Date(reference.lastSyncedAt),
      createdAt: new Date(reference.createdAt),
      updatedAt: new Date(reference.updatedAt),
    };
  }

  private toConnection(record: StoredSupplierConnection): AutoDSConnection {
    return {
      id: record.id,
      tenantId: record.tenantId,
      storeId: record.storeId,
      ...(record.shopDomain === null ? {} : { shopDomain: record.shopDomain as `${string}.myshopify.com` }),
      supplierProvider: record.supplierProvider,
      status: record.status as AutoDSConnection["status"],
      ...(record.credentialsReference === null ? {} : { credentialsReference: this.clone(record.credentialsReference) as NonNullable<AutoDSConnection["credentialsReference"]> }),
      capabilities: this.clone(record.capabilities) as AutoDSConnection["capabilities"],
      health: this.clone(record.healthSnapshot) as SupplierHealth,
      ...(record.connectedAt === null ? {} : { connectedAt: record.connectedAt.toISOString() }),
      ...(record.disconnectedAt === null ? {} : { disconnectedAt: record.disconnectedAt.toISOString() }),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toImportJob(record: StoredSupplierImportJob): SupplierImportJob {
    return {
      id: record.id,
      tenantId: record.tenantId,
      storeId: record.storeId,
      ...(record.shopDomain === null ? {} : { shopDomain: record.shopDomain as `${string}.myshopify.com` }),
      supplierProvider: record.supplierProvider,
      status: record.status as SupplierImportJob["status"],
      idempotencyKey: record.idempotencyKey,
      requestedBy: record.requestedBy,
      force: record.force,
      productReferenceIds: this.clone(record.productReferenceIds) as readonly string[],
      productImportIds: this.clone(record.productImportIds) as readonly string[],
      warnings: this.clone(record.warnings) as readonly string[],
      ...(record.failure === null ? {} : { failure: this.clone(record.failure) as NonNullable<SupplierImportJob["failure"]> }),
      ...(record.auditReference === null ? {} : { auditReference: record.auditReference }),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      ...(record.completedAt === null ? {} : { completedAt: record.completedAt.toISOString() }),
    };
  }

  private toSyncJob(record: StoredSupplierSyncJob): SupplierSyncJob {
    return {
      id: record.id,
      tenantId: record.tenantId,
      storeId: record.storeId,
      ...(record.shopDomain === null ? {} : { shopDomain: record.shopDomain as `${string}.myshopify.com` }),
      supplierProvider: record.supplierProvider,
      syncType: record.syncType as SupplierSyncJob["syncType"],
      status: record.status as SupplierSyncJob["status"],
      idempotencyKey: record.idempotencyKey,
      productReferenceIds: this.clone(record.productReferenceIds) as readonly string[],
      warnings: this.clone(record.warnings) as readonly string[],
      ...(record.failure === null ? {} : { failure: this.clone(record.failure) as NonNullable<SupplierSyncJob["failure"]> }),
      ...(record.auditReference === null ? {} : { auditReference: record.auditReference }),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      ...(record.completedAt === null ? {} : { completedAt: record.completedAt.toISOString() }),
    };
  }

  private toProductReference(record: StoredSupplierProductReference): SupplierProductReference {
    return {
      id: record.id,
      tenantId: record.tenantId,
      storeId: record.storeId,
      ...(record.shopDomain === null ? {} : { shopDomain: record.shopDomain as `${string}.myshopify.com` }),
      supplierProvider: record.supplierProvider,
      externalProductId: record.externalProductId,
      title: record.title,
      ...(record.brand === null ? {} : { brand: record.brand }),
      ...(record.category === null ? {} : { category: record.category }),
      ...(record.productType === null ? {} : { productType: record.productType }),
      ...(record.inventorySnapshot === null ? {} : { inventorySnapshot: this.clone(record.inventorySnapshot) as NonNullable<SupplierProductReference["inventorySnapshot"]> }),
      pricingSnapshot: this.clone(record.pricingSnapshot) as SupplierProductReference["pricingSnapshot"],
      mediaReferences: this.clone(record.mediaReferences) as SupplierProductReference["mediaReferences"],
      shippingProfile: this.clone(record.shippingProfile) as SupplierProductReference["shippingProfile"],
      ...(record.rawPayload === null ? {} : { rawPayload: this.clone(record.rawPayload) as NonNullable<SupplierProductReference["rawPayload"]> }),
      ...(record.lastSyncedAt === null ? {} : { lastSyncedAt: record.lastSyncedAt.toISOString() }),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export const prismaSupplierIntegrationRepository = new PrismaSupplierIntegrationRepository(
  supplierPrisma.supplierConnection,
  supplierPrisma.supplierImportJob,
  supplierPrisma.supplierSyncJob,
  supplierPrisma.supplierProductReference,
);
