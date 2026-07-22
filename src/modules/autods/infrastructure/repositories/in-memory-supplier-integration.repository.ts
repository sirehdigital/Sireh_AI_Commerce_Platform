import type {
  SupplierConnectionIdentity,
  SupplierIntegrationRepository,
  SupplierJobListQuery,
  SupplierJobListResult,
} from "../../domain/repositories/supplier-integration.repository.js";
import type {
  AutoDSConnection,
  SupplierImportJob,
  SupplierProductReference,
  SupplierSyncJob,
} from "../../domain/models/supplier-integration.model.js";

export class InMemorySupplierIntegrationRepository implements SupplierIntegrationRepository {
  private readonly connections = new Map<string, AutoDSConnection>();
  private readonly productReferences = new Map<string, SupplierProductReference>();
  private readonly importJobs = new Map<string, SupplierImportJob>();
  private readonly syncJobs = new Map<string, SupplierSyncJob>();

  public findConnection(identity: SupplierConnectionIdentity): Promise<AutoDSConnection | undefined> {
    return Promise.resolve(cloneOptional(this.connections.get(connectionKey(identity))));
  }

  public saveConnection(connection: AutoDSConnection): Promise<AutoDSConnection> {
    this.connections.set(connectionKey(connection), clone(connection));
    return Promise.resolve(clone(connection));
  }

  public saveProductReference(reference: SupplierProductReference): Promise<SupplierProductReference> {
    this.productReferences.set(productReferenceKey(reference), clone(reference));
    return Promise.resolve(clone(reference));
  }

  public findProductReference(
    identity: SupplierConnectionIdentity & { readonly externalProductId: string },
  ): Promise<SupplierProductReference | undefined> {
    return Promise.resolve(cloneOptional(this.productReferences.get(productReferenceKey(identity))));
  }

  public createImportJob(job: SupplierImportJob): Promise<SupplierImportJob> {
    this.importJobs.set(job.id, clone(job));
    return Promise.resolve(clone(job));
  }

  public updateImportJob(job: SupplierImportJob): Promise<SupplierImportJob> {
    this.importJobs.set(job.id, clone(job));
    return Promise.resolve(clone(job));
  }

  public findImportJobById(jobId: string): Promise<SupplierImportJob | undefined> {
    return Promise.resolve(cloneOptional(this.importJobs.get(jobId)));
  }

  public findImportJobByIdempotencyKey(idempotencyKey: string): Promise<SupplierImportJob | undefined> {
    return Promise.resolve(cloneOptional([...this.importJobs.values()].find((job) => job.idempotencyKey === idempotencyKey)));
  }

  public listImportJobs(query: SupplierJobListQuery = {}): Promise<SupplierJobListResult<SupplierImportJob>> {
    return Promise.resolve(listJobs([...this.importJobs.values()], query));
  }

  public createSyncJob(job: SupplierSyncJob): Promise<SupplierSyncJob> {
    this.syncJobs.set(job.id, clone(job));
    return Promise.resolve(clone(job));
  }

  public updateSyncJob(job: SupplierSyncJob): Promise<SupplierSyncJob> {
    this.syncJobs.set(job.id, clone(job));
    return Promise.resolve(clone(job));
  }

  public findSyncJobById(jobId: string): Promise<SupplierSyncJob | undefined> {
    return Promise.resolve(cloneOptional(this.syncJobs.get(jobId)));
  }

  public findSyncJobByIdempotencyKey(idempotencyKey: string): Promise<SupplierSyncJob | undefined> {
    return Promise.resolve(cloneOptional([...this.syncJobs.values()].find((job) => job.idempotencyKey === idempotencyKey)));
  }

  public listSyncJobs(query: SupplierJobListQuery = {}): Promise<SupplierJobListResult<SupplierSyncJob>> {
    return Promise.resolve(listJobs([...this.syncJobs.values()], query));
  }
}

function connectionKey(identity: SupplierConnectionIdentity): string {
  return `${identity.tenantId}:${identity.storeId}:${identity.supplierProvider}`.toLowerCase();
}

function productReferenceKey(identity: SupplierConnectionIdentity & { readonly externalProductId: string }): string {
  return `${connectionKey(identity)}:${identity.externalProductId}`.toLowerCase();
}

function listJobs<TJob extends SupplierImportJob | SupplierSyncJob>(
  jobs: readonly TJob[],
  query: SupplierJobListQuery,
): SupplierJobListResult<TJob> {
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  const filtered = jobs
    .filter((job) => query.tenantId === undefined || job.tenantId === query.tenantId)
    .filter((job) => query.storeId === undefined || job.storeId === query.storeId)
    .filter((job) => query.supplierProvider === undefined || job.supplierProvider === query.supplierProvider)
    .filter((job) => query.status === undefined || job.status === query.status)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const items = filtered.slice(offset, offset + limit).map((job) => clone(job));
  const nextOffset = offset + items.length;

  return {
    items,
    total: filtered.length,
    limit,
    offset,
    hasNextPage: nextOffset < filtered.length,
    ...(nextOffset < filtered.length ? { nextOffset } : {}),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}
