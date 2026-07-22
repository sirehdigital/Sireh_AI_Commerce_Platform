import type {
  AutoDSConnection,
  SupplierImportJob,
  SupplierProductReference,
  SupplierProviderId,
  SupplierSyncJob,
} from "../models/supplier-integration.model.js";

export interface SupplierConnectionIdentity {
  readonly tenantId: string;
  readonly storeId: string;
  readonly supplierProvider: SupplierProviderId;
}

export interface SupplierJobListQuery {
  readonly tenantId?: string;
  readonly storeId?: string;
  readonly supplierProvider?: SupplierProviderId;
  readonly status?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SupplierJobListResult<TJob> {
  readonly items: readonly TJob[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}

export interface SupplierIntegrationRepository {
  findConnection(identity: SupplierConnectionIdentity): Promise<AutoDSConnection | undefined>;
  saveConnection(connection: AutoDSConnection): Promise<AutoDSConnection>;
  saveProductReference(reference: SupplierProductReference): Promise<SupplierProductReference>;
  findProductReference(identity: SupplierConnectionIdentity & { readonly externalProductId: string }): Promise<SupplierProductReference | undefined>;
  createImportJob(job: SupplierImportJob): Promise<SupplierImportJob>;
  updateImportJob(job: SupplierImportJob): Promise<SupplierImportJob>;
  findImportJobById(jobId: string): Promise<SupplierImportJob | undefined>;
  findImportJobByIdempotencyKey(idempotencyKey: string): Promise<SupplierImportJob | undefined>;
  listImportJobs(query?: SupplierJobListQuery): Promise<SupplierJobListResult<SupplierImportJob>>;
  createSyncJob(job: SupplierSyncJob): Promise<SupplierSyncJob>;
  updateSyncJob(job: SupplierSyncJob): Promise<SupplierSyncJob>;
  findSyncJobById(jobId: string): Promise<SupplierSyncJob | undefined>;
  findSyncJobByIdempotencyKey(idempotencyKey: string): Promise<SupplierSyncJob | undefined>;
  listSyncJobs(query?: SupplierJobListQuery): Promise<SupplierJobListResult<SupplierSyncJob>>;
}
