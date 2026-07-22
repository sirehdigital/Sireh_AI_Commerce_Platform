import { AppError } from "../../../../shared/errors/app-error.js";
import type { TenantContext, AuditRecord } from "../../../saie/application/index.js";
import type { ProductImportDetailResponse, ProductImportStartRequest } from "../../../product-import/application/services/product-import-api.service.js";
import type { SupplierProductImportInput } from "../../../product-import/domain/models/product-import.model.js";
import type { SupplierProvider } from "../providers/supplier-provider.js";
import type {
  AutoDSConnection,
  SupplierCredentialsReference,
  SupplierHealth,
  SupplierImportJob,
  SupplierImportRequest,
  SupplierProduct,
  SupplierProductReference,
  SupplierProviderFailure,
  SupplierProviderId,
  SupplierProviderResult,
  SupplierSyncJob,
  SupplierSyncRequest,
} from "../../domain/models/supplier-integration.model.js";
import type { SupplierIntegrationRepository } from "../../domain/repositories/supplier-integration.repository.js";

type MaybePromise<T> = T | Promise<T>;

export interface SupplierProductImportApi {
  startImport(request: ProductImportStartRequest, tenant: TenantContext): Promise<ProductImportDetailResponse>;
}

export interface SupplierIntegrationAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface SupplierConnectionRequest {
  readonly provider: SupplierProviderId;
  readonly credentialsReference: SupplierCredentialsReference;
  readonly correlationId?: string;
}

export interface SupplierConnectionStatusResponse {
  readonly connection?: AutoDSConnection;
  readonly health?: SupplierHealth;
}

export interface SupplierIntegrationEngineDependencies {
  readonly repository: SupplierIntegrationRepository;
  readonly productImportApi?: SupplierProductImportApi;
  readonly auditRepository?: SupplierIntegrationAuditRepository;
  readonly providers: readonly SupplierProvider[];
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

const optionalField = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> => (value === undefined ? {} : ({ [key]: value } as Record<Key, Value>));

export class SupplierIntegrationEngineService {
  private readonly providerRegistry: ReadonlyMap<SupplierProviderId, SupplierProvider>;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  public constructor(private readonly dependencies: SupplierIntegrationEngineDependencies) {
    this.providerRegistry = new Map(dependencies.providers.map((provider) => [provider.id, provider]));
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? (() => crypto.randomUUID());
  }

  public async connect(request: SupplierConnectionRequest, tenant: TenantContext): Promise<AutoDSConnection> {
    const provider = this.resolveProvider(request.provider);
    const result = await provider.connect({ tenant, credentialsReference: this.validateCredentialReference(request.credentialsReference, provider.id) });
    const connection = this.requireProviderValue(result, "SUPPLIER_CONNECT_FAILED");
    const saved = await this.dependencies.repository.saveConnection(connection);
    await this.audit(tenant, "supplier.connection.connected", saved.id, "Supplier connection established.", request.correlationId, {
      provider: provider.id,
      status: saved.status,
      warnings: result.warnings,
    });
    return saved;
  }

  public async disconnect(providerId: SupplierProviderId, tenant: TenantContext, correlationId?: string): Promise<AutoDSConnection> {
    const provider = this.resolveProvider(providerId);
    const result = await provider.disconnect(tenant);
    const disconnected = this.requireProviderValue(result, "SUPPLIER_DISCONNECT_FAILED");
    const existing = await this.dependencies.repository.findConnection(this.identity(tenant, provider.id));
    const saved = await this.dependencies.repository.saveConnection({
      ...disconnected,
      id: existing?.id ?? disconnected.id,
      createdAt: existing?.createdAt ?? disconnected.createdAt,
    });
    await this.audit(tenant, "supplier.connection.disconnected", saved.id, "Supplier connection disconnected.", correlationId, {
      provider: provider.id,
      status: saved.status,
    });
    return saved;
  }

  public async status(providerId: SupplierProviderId, tenant: TenantContext): Promise<SupplierConnectionStatusResponse> {
    const provider = this.resolveProvider(providerId);
    const [connection, health] = await Promise.all([
      this.dependencies.repository.findConnection(this.identity(tenant, provider.id)),
      provider.health(tenant),
    ]);
    return {
      ...(connection === undefined ? {} : { connection }),
      ...(health.value === undefined ? {} : { health: health.value }),
    };
  }

  public async health(providerId: SupplierProviderId, tenant: TenantContext, correlationId?: string): Promise<SupplierHealth> {
    const provider = this.resolveProvider(providerId);
    const result = await provider.health(tenant);
    const health = this.requireProviderValue(result, "SUPPLIER_HEALTH_FAILED");
    const existing = await this.dependencies.repository.findConnection(this.identity(tenant, provider.id));
    if (existing !== undefined) {
      await this.dependencies.repository.saveConnection({
        ...existing,
        health,
        status: this.connectionStatusFromHealth(health.status),
        updatedAt: this.timestamp(),
      });
    }
    await this.audit(tenant, "supplier.health.checked", `supplier-health:${provider.id}`, "Supplier health checked.", correlationId, {
      provider: provider.id,
      status: health.status,
      warnings: result.warnings,
    });
    return health;
  }

  public async importProducts(request: SupplierImportRequest, tenant: TenantContext): Promise<SupplierImportJob> {
    const provider = this.resolveProvider(request.provider);
    const idempotencyKey = this.jobIdempotencyKey(tenant, provider.id, "import", request.externalProductIds);
    const existing = await this.dependencies.repository.findImportJobByIdempotencyKey(idempotencyKey);
    if (existing !== undefined && request.force !== true) {
      return existing;
    }

    const created = await this.dependencies.repository.createImportJob(this.newImportJob(tenant, provider.id, idempotencyKey, request));
    const running = await this.dependencies.repository.updateImportJob({ ...created, status: "running", updatedAt: this.timestamp() });

    try {
      const result = await provider.importProducts({
        tenant,
        ...optionalField("externalProductIds", request.externalProductIds),
      });
      if (!result.ok || result.value === undefined) {
      return this.failImportJob(running, this.providerFailure(result), tenant, request.correlationId);
      }

      const references: SupplierProductReference[] = [];
      const productImportIds: string[] = [];
      for (const product of result.value) {
        const reference = await this.dependencies.repository.saveProductReference(this.toProductReference(product, tenant, provider.id));
        references.push(reference);
        const importResult = await this.startProductImport(product, request, tenant, provider.id);
        if (importResult !== undefined) {
          productImportIds.push(importResult.importId);
        }
      }

      const completed: SupplierImportJob = {
        ...running,
        status: "completed",
        productReferenceIds: references.map((reference) => reference.id),
        productImportIds,
        warnings: result.warnings,
        updatedAt: this.timestamp(),
        completedAt: this.timestamp(),
        auditReference: this.auditId(running.id),
      };
      const saved = await this.dependencies.repository.updateImportJob(completed);
      await this.audit(tenant, "supplier.import.completed", saved.id, "Supplier import completed.", request.correlationId, {
        provider: provider.id,
        productCount: references.length,
        productImportIds,
        warnings: result.warnings,
      });
      return saved;
    } catch (error: unknown) {
      return this.failImportJob(running, this.toFailure(error), tenant, request.correlationId);
    }
  }

  public async sync(request: SupplierSyncRequest, tenant: TenantContext): Promise<SupplierSyncJob> {
    const provider = this.resolveProvider(request.provider);
    const idempotencyKey = this.jobIdempotencyKey(tenant, provider.id, `sync:${request.syncType}`, request.externalProductIds);
    const existing = await this.dependencies.repository.findSyncJobByIdempotencyKey(idempotencyKey);
    if (existing !== undefined && request.force !== true) {
      return existing;
    }

    const created = await this.dependencies.repository.createSyncJob(this.newSyncJob(tenant, provider.id, idempotencyKey, request));
    const running = await this.dependencies.repository.updateSyncJob({ ...created, status: "running", updatedAt: this.timestamp() });
    try {
      const result = await this.executeSync(provider, request, tenant);
      if (!result.ok || result.value === undefined) {
        return this.failSyncJob(running, this.providerFailure(result), tenant, request.correlationId);
      }

      const references = await Promise.all(
        result.value.map((product) => this.dependencies.repository.saveProductReference(this.toProductReference(product, tenant, provider.id))),
      );
      const completed: SupplierSyncJob = {
        ...running,
        status: "completed",
        productReferenceIds: references.map((reference) => reference.id),
        warnings: result.warnings,
        updatedAt: this.timestamp(),
        completedAt: this.timestamp(),
        auditReference: this.auditId(running.id),
      };
      const saved = await this.dependencies.repository.updateSyncJob(completed);
      await this.audit(tenant, "supplier.sync.completed", saved.id, "Supplier sync completed.", request.correlationId, {
        provider: provider.id,
        syncType: request.syncType,
        productCount: references.length,
        warnings: result.warnings,
      });
      return saved;
    } catch (error: unknown) {
      return this.failSyncJob(running, this.toFailure(error), tenant, request.correlationId);
    }
  }

  public listImportJobs(tenant: TenantContext): Promise<ReturnType<SupplierIntegrationRepository["listImportJobs"]> extends Promise<infer Result> ? Result : never> {
    return this.dependencies.repository.listImportJobs({ tenantId: tenant.tenantId, storeId: tenant.storeId });
  }

  public async getImportJob(jobId: string, tenant: TenantContext): Promise<SupplierImportJob> {
    const job = await this.dependencies.repository.findImportJobById(this.requireText(jobId, "Supplier import job ID is required."));
    if (job?.tenantId !== tenant.tenantId || job.storeId !== tenant.storeId) {
      throw AppError.notFound("Supplier import job was not found.", { jobId }, "SUPPLIER_IMPORT_JOB_NOT_FOUND");
    }
    return job;
  }

  private async startProductImport(
    product: SupplierProduct,
    request: SupplierImportRequest,
    tenant: TenantContext,
    providerId: SupplierProviderId,
  ): Promise<ProductImportDetailResponse | undefined> {
    if (this.dependencies.productImportApi === undefined) {
      return undefined;
    }

    return this.dependencies.productImportApi.startImport({
      sourcePlatform: providerId === "autods" ? "autods" : product.sourcePlatform,
      payload: this.toProductImportPayload(product, providerId),
      requestedBy: request.requestedBy,
      forceReimport: request.force === true,
      ...optionalField("correlationId", request.correlationId),
    }, tenant);
  }

  private toProductImportPayload(product: SupplierProduct, providerId: SupplierProviderId): SupplierProductImportInput {
    return {
      externalProductId: product.externalProductId,
      sourcePlatform: providerId === "autods" ? "autods" : product.sourcePlatform,
      ...optionalField("supplierName", product.supplierName),
      ...optionalField("supplierUrl", product.supplierUrl),
      title: product.title,
      ...optionalField("description", product.description),
      ...optionalField("brand", product.brand),
      ...optionalField("category", product.category),
      ...optionalField("productType", product.productType),
      images: product.media.map((media) => ({
        url: media.url,
        ...optionalField("altText", media.altText),
        ...optionalField("position", media.position),
      })),
      variants: product.variants.map((variant) => ({
        ...optionalField("externalVariantId", variant.externalVariantId),
        ...optionalField("sku", variant.sku),
        ...optionalField("title", variant.title),
        ...optionalField("optionValues", variant.optionValues),
        ...optionalField("supplierPrice", variant.pricing.supplierPrice),
        ...optionalField("compareAtPrice", variant.pricing.compareAtPrice),
        currency: variant.pricing.currency,
        ...optionalField("inventory", variant.inventory?.quantity),
        ...optionalField("imageUrl", variant.imageUrl),
        ...optionalField("available", variant.inventory?.available),
      })),
      ...optionalField("supplierPrice", product.pricing.supplierPrice),
      ...optionalField("compareAtPrice", product.pricing.compareAtPrice),
      currency: product.pricing.currency,
      ...optionalField("inventory", product.inventory?.quantity),
      ...optionalField("shippingOrigin", product.shipping.origin),
      shippingDestinations: product.shipping.destinations,
      ...optionalField("estimatedDelivery", product.shipping.estimatedDelivery),
      tags: product.tags,
      rawMetadata: {
        ...product.rawMetadata,
        supplierProvider: providerId,
        mediaReferences: product.media,
      },
    };
  }

  private toProductReference(product: SupplierProduct, tenant: TenantContext, providerId: SupplierProviderId): SupplierProductReference {
    const timestamp = this.timestamp();
    return {
      id: `supplier-product:${tenant.tenantId}:${tenant.storeId}:${providerId}:${product.externalProductId}`.toLowerCase(),
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      supplierProvider: providerId,
      externalProductId: product.externalProductId,
      title: product.title,
      ...optionalField("brand", product.brand),
      ...optionalField("category", product.category),
      ...optionalField("productType", product.productType),
      ...optionalField("inventorySnapshot", product.inventory),
      pricingSnapshot: product.pricing,
      mediaReferences: product.media,
      shippingProfile: product.shipping,
      rawPayload: this.redact(product.rawMetadata),
      lastSyncedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async executeSync(
    provider: SupplierProvider,
    request: SupplierSyncRequest,
    tenant: TenantContext,
  ): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    const providerRequest = {
      tenant,
      syncType: request.syncType,
      ...optionalField("externalProductIds", request.externalProductIds),
    };
    switch (request.syncType) {
      case "inventory":
        return provider.syncInventory(providerRequest);
      case "pricing":
        return provider.syncPricing(providerRequest);
      case "media":
        return provider.syncMedia(providerRequest);
      case "shipping":
        return provider.syncShipping(providerRequest);
      case "full":
        return provider.importProducts({
          tenant,
          ...optionalField("externalProductIds", request.externalProductIds),
        });
    }
  }

  private newImportJob(
    tenant: TenantContext,
    providerId: SupplierProviderId,
    idempotencyKey: string,
    request: SupplierImportRequest,
  ): SupplierImportJob {
    const timestamp = this.timestamp();
    return {
      id: `supplier-import:${this.idGenerator()}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      supplierProvider: providerId,
      status: "queued",
      idempotencyKey,
      requestedBy: request.requestedBy,
      force: request.force === true,
      productReferenceIds: [],
      productImportIds: [],
      warnings: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private newSyncJob(
    tenant: TenantContext,
    providerId: SupplierProviderId,
    idempotencyKey: string,
    request: SupplierSyncRequest,
  ): SupplierSyncJob {
    const timestamp = this.timestamp();
    return {
      id: `supplier-sync:${this.idGenerator()}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      supplierProvider: providerId,
      syncType: request.syncType,
      status: "queued",
      idempotencyKey,
      productReferenceIds: [],
      warnings: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async failImportJob(
    job: SupplierImportJob,
    failure: SupplierProviderFailure,
    tenant: TenantContext,
    correlationId: string | undefined,
  ): Promise<SupplierImportJob> {
    const failed: SupplierImportJob = {
      ...job,
      status: "failed",
      failure,
      updatedAt: this.timestamp(),
      completedAt: this.timestamp(),
      auditReference: this.auditId(job.id),
    };
    const saved = await this.dependencies.repository.updateImportJob(failed);
    await this.audit(tenant, "supplier.import.failed", saved.id, "Supplier import failed safely.", correlationId, this.failureDetails(failure));
    return saved;
  }

  private async failSyncJob(
    job: SupplierSyncJob,
    failure: SupplierProviderFailure,
    tenant: TenantContext,
    correlationId: string | undefined,
  ): Promise<SupplierSyncJob> {
    const failed: SupplierSyncJob = {
      ...job,
      status: failure.retryable ? "retrying" : "failed",
      failure,
      updatedAt: this.timestamp(),
      auditReference: this.auditId(job.id),
      ...(failure.retryable ? {} : { completedAt: this.timestamp() }),
    };
    const saved = await this.dependencies.repository.updateSyncJob(failed);
    await this.audit(tenant, "supplier.sync.failed", saved.id, "Supplier sync failed safely.", correlationId, this.failureDetails(failure));
    return saved;
  }

  private validateCredentialReference(reference: SupplierCredentialsReference, providerId: SupplierProviderId): SupplierCredentialsReference {
    const referenceId = this.requireText(reference.referenceId, "Supplier credential reference ID is required.");
    return {
      referenceId,
      provider: providerId,
      ...optionalField("label", this.optionalText(reference.label)),
      ...optionalField("expiresAt", this.optionalText(reference.expiresAt)),
    };
  }

  private requireProviderValue<T>(result: SupplierProviderResult<T>, code: string): T {
    if (result.ok && result.value !== undefined) {
      return result.value;
    }
    const failure = this.providerFailure(result);
    throw AppError.badRequest(failure.message, { failure }, failure.code || code);
  }

  private providerFailure(result: SupplierProviderResult<unknown>): SupplierProviderFailure {
    return result.failure ?? {
      code: "SUPPLIER_PROVIDER_FAILED",
      message: "Supplier provider operation failed.",
      retryable: false,
    };
  }

  private toFailure(error: unknown): SupplierProviderFailure {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.statusCode >= 500,
        ...optionalField("details", error.details),
      };
    }
    return {
      code: "SUPPLIER_OPERATION_FAILED",
      message: error instanceof Error ? error.message : "Supplier operation failed.",
      retryable: false,
    };
  }

  private resolveProvider(providerId: SupplierProviderId): SupplierProvider {
    const normalizedProviderId = this.requireText(providerId, "Supplier provider is required.").toLowerCase();
    const provider = this.providerRegistry.get(normalizedProviderId);
    if (provider === undefined) {
      throw AppError.badRequest("Supplier provider is not supported.", { provider: providerId }, "SUPPLIER_PROVIDER_UNSUPPORTED");
    }
    return provider;
  }

  private identity(tenant: TenantContext, provider: SupplierProviderId) {
    return { tenantId: tenant.tenantId, storeId: tenant.storeId, supplierProvider: provider };
  }

  private connectionStatusFromHealth(status: SupplierHealth["status"]): AutoDSConnection["status"] {
    if (status === "AUTH_FAILED") {
      return "INVALID";
    }
    if (status === "OFFLINE" || status === "RATE_LIMITED") {
      return "ERROR";
    }
    return "CONNECTED";
  }

  private jobIdempotencyKey(
    tenant: TenantContext,
    provider: SupplierProviderId,
    operation: string,
    externalProductIds: readonly string[] | undefined,
  ): string {
    const ids = externalProductIds === undefined || externalProductIds.length === 0
      ? "all"
      : [...externalProductIds].map((id) => id.trim().toLowerCase()).sort().join(",");
    return `${tenant.tenantId}:${tenant.storeId}:${provider}:${operation}:${ids}`.toLowerCase();
  }

  private async audit(
    tenant: TenantContext,
    eventType: string,
    entityId: string,
    summary: string,
    correlationId: string | undefined,
    details: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    if (this.dependencies.auditRepository === undefined) {
      return;
    }
    await this.dependencies.auditRepository.append(tenant, {
      ...tenant,
      id: this.auditId(entityId),
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "autods-integration-engine",
      occurredAt: this.timestamp(),
      summary,
      details: this.primitiveDetails({ ...details, supplierEventType: eventType }),
      source: "deterministic-preview",
      sequence: this.sequence(entityId),
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "supplier.integration",
      status: eventType.endsWith(".failed") ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.timestamp(),
    });
  }

  private auditId(entityId: string): string {
    return `audit:${entityId}`;
  }

  private sequence(value: string): number {
    return Math.abs([...value].reduce((sum, character) => sum + character.charCodeAt(0), 0));
  }

  private redact(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      if (/token|secret|password|credential|authorization|api[-_]?key/iu.test(key)) {
        return [key, "[REDACTED]"];
      }
      if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
        return [key, this.redact(entry as Readonly<Record<string, unknown>>)];
      }
      return [key, entry];
    }));
  }

  private failureDetails(failure: SupplierProviderFailure): Readonly<Record<string, unknown>> {
    return {
      code: failure.code,
      message: failure.message,
      retryable: failure.retryable,
      ...(failure.rateLimited === undefined ? {} : { rateLimited: failure.rateLimited }),
      ...(failure.details === undefined ? {} : { details: failure.details }),
    };
  }

  private primitiveDetails(value: Readonly<Record<string, unknown>>): Readonly<Record<string, string | number | boolean | null>> {
    return Object.fromEntries(Object.entries(this.redact(value)).map(([key, entry]) => {
      if (entry === null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
        return [key, entry];
      }
      return [key, JSON.stringify(entry)];
    }));
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private requireText(value: string | undefined, message: string): string {
    const text = this.optionalText(value);
    if (text === undefined) {
      throw AppError.badRequest(message, {}, "SUPPLIER_INPUT_INVALID");
    }
    return text;
  }

  private optionalText(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text === undefined || text.length === 0 ? undefined : text;
  }
}
