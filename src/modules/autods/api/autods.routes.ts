import { randomUUID } from "node:crypto";

import { Router, type Request, type RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { CreateProductDraftService } from "../../product-draft/application/services/create-product-draft.service.js";
import { createPrismaProductDraftRepository } from "../../product-draft/infrastructure/repositories/prisma-product-draft.repository.js";
import { AIProductImportPipelineService } from "../../product-import/application/services/ai-product-import-pipeline.service.js";
import { ProductImportApiService } from "../../product-import/application/services/product-import-api.service.js";
import { prismaProductImportRepository } from "../../product-import/infrastructure/repositories/prisma-product-import.repository.js";
import { DEFAULT_TENANT_CONTEXT, ProcessLocalTenantRegistry } from "../../saie/application/index.js";
import { prismaApprovalRepository, prismaAuditRepository } from "../../saie/infrastructure/index.js";
import { SupplierIntegrationEngineService } from "../application/services/supplier-integration-engine.service.js";
import type { SupplierProvider } from "../application/providers/supplier-provider.js";
import type { SupplierProviderId, SupplierSyncType } from "../domain/models/supplier-integration.model.js";
import type { SupplierIntegrationRepository } from "../domain/repositories/supplier-integration.repository.js";
import { AutoDSProvider } from "../infrastructure/providers/autods.provider.js";
import { prismaSupplierIntegrationRepository } from "../infrastructure/repositories/prisma-supplier-integration.repository.js";

const SYNC_TYPES = new Set(["inventory", "pricing", "media", "shipping", "full"]);

export interface AutoDSRouterOptions {
  readonly service?: SupplierIntegrationEngineService;
  readonly repository?: SupplierIntegrationRepository;
  readonly providers?: readonly SupplierProvider[];
  readonly idGenerator?: () => string;
  readonly now?: () => Date;
}

export const createAutoDSRouter = (options: AutoDSRouterOptions = {}): Router => {
  const router = Router();
  const service = options.service ?? createDefaultService(options);

  router.post("/connect", asyncHandler(async (request, response) => {
    const body = asRecord(request.body, "body");
    const result = await service.connect({
      provider: parseProvider(body.provider),
      credentialsReference: {
        referenceId: parseRequiredText(body.credentialsReferenceId ?? body.credentialReferenceId, "credentialsReferenceId"),
        provider: parseProvider(body.provider),
        ...optionalTextField("label", body.credentialsLabel),
        ...optionalTextField("expiresAt", body.credentialsExpiresAt),
      },
      ...optionalTextField("correlationId", body.correlationId),
    }, resolveTenant(request));
    response.status(201).json({ success: true, data: result });
  }));

  router.post("/disconnect", asyncHandler(async (request, response) => {
    const body = asRecord(request.body, "body");
    const result = await service.disconnect(
      parseProvider(body.provider),
      resolveTenant(request),
      parseOptionalText(body.correlationId),
    );
    response.status(200).json({ success: true, data: result });
  }));

  router.get("/status", asyncHandler(async (request, response) => {
    const result = await service.status(parseProvider(request.query.provider), resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  router.get("/health", asyncHandler(async (request, response) => {
    const result = await service.health(parseProvider(request.query.provider), resolveTenant(request), parseOptionalText(request.query.correlationId));
    response.status(200).json({ success: true, data: result });
  }));

  router.post("/import", asyncHandler(async (request, response) => {
    const body = asRecord(request.body, "body");
    const result = await service.importProducts({
      provider: parseProvider(body.provider),
      requestedBy: parseOptionalText(body.requestedBy) ?? "merchant-api",
      ...optionalStringArrayField("externalProductIds", body.externalProductIds),
      force: body.force === true || body.forceReimport === true,
      ...optionalTextField("correlationId", body.correlationId),
    }, resolveTenant(request));
    response.status(result.status === "failed" ? 202 : 201).json({ success: true, data: result });
  }));

  router.post("/sync", asyncHandler(async (request, response) => {
    const body = asRecord(request.body, "body");
    const result = await service.sync({
      provider: parseProvider(body.provider),
      syncType: parseSyncType(body.syncType),
      ...optionalStringArrayField("externalProductIds", body.externalProductIds),
      force: body.force === true,
      ...optionalTextField("correlationId", body.correlationId),
    }, resolveTenant(request));
    response.status(202).json({ success: true, data: result });
  }));

  router.get("/jobs", asyncHandler(async (request, response) => {
    const result = await service.listImportJobs(resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  router.get("/jobs/:id", asyncHandler(async (request, response) => {
    const result = await service.getImportJob(parseRequiredText(request.params.id, "id"), resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  return router;
};

function createDefaultService(options: AutoDSRouterOptions): SupplierIntegrationEngineService {
  const now = options.now ?? (() => new Date());
  const idGenerator = options.idGenerator ?? randomUUID;
  const productImportApi = createProductImportApi(now, idGenerator);
  return new SupplierIntegrationEngineService({
    repository: options.repository ?? prismaSupplierIntegrationRepository,
    productImportApi,
    auditRepository: prismaAuditRepository,
    providers: options.providers ?? [new AutoDSProvider(() => now().toISOString())],
    now,
    idGenerator,
  });
}

function createProductImportApi(now: () => Date, idGenerator: () => string): ProductImportApiService {
  const pipeline = new AIProductImportPipelineService({
    productImportRepository: prismaProductImportRepository,
    draftService: new CreateProductDraftService({
      repository: createPrismaProductDraftRepository(DEFAULT_TENANT_CONTEXT),
      idGenerator,
      clock: () => now().toISOString(),
    }),
    draftServiceFactory: (tenant) => new CreateProductDraftService({
      repository: createPrismaProductDraftRepository(tenant),
      idGenerator,
      clock: () => now().toISOString(),
    }),
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
    idGenerator,
    now,
  });
  return new ProductImportApiService(pipeline, prismaProductImportRepository, {
    productDraftRepositoryFactory: createPrismaProductDraftRepository,
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
  });
}

const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

const resolveTenant = (request: Request) => {
  const registry = new ProcessLocalTenantRegistry([DEFAULT_TENANT_CONTEXT]);
  return registry.resolveTenant({
    tenantId: parseOptionalHeader(request, "x-saie-tenant-id") ?? DEFAULT_TENANT_CONTEXT.tenantId,
    storeId: parseOptionalHeader(request, "x-saie-store-id") ?? DEFAULT_TENANT_CONTEXT.storeId,
    shopDomain: parseOptionalHeader(request, "x-saie-shop-domain"),
  });
};

function parseProvider(value: unknown): SupplierProviderId {
  return parseRequiredText(value, "provider").toLowerCase();
}

function parseSyncType(value: unknown): SupplierSyncType {
  const syncType = parseRequiredText(value, "syncType").toLowerCase();
  if (!SYNC_TYPES.has(syncType)) {
    throw AppError.badRequest("Supplier sync type is invalid.", { field: "syncType" }, "SUPPLIER_SYNC_TYPE_INVALID");
  }
  return syncType as SupplierSyncType;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw AppError.badRequest("Request body must be an object.", { field }, "SUPPLIER_BODY_INVALID");
  }
  return value as Record<string, unknown>;
}

function parseRequiredText(value: unknown, field: string): string {
  const text = parseOptionalText(value);
  if (text === undefined) {
    throw AppError.badRequest("Required text field is missing.", { field }, "SUPPLIER_REQUIRED_FIELD_MISSING");
  }
  return text;
}

function parseOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const text = value.trim();
  return text.length === 0 ? undefined : text;
}

function parseOptionalHeader(request: Request, name: string): string | undefined {
  return parseOptionalText(request.header(name));
}

function optionalTextField<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
  const text = parseOptionalText(value);
  return text === undefined ? {} : ({ [key]: text } as Record<Key, string>);
}

function optionalStringArrayField<Key extends string>(key: Key, value: unknown): Partial<Record<Key, readonly string[]>> {
  if (value === undefined) {
    return {};
  }
  if (!Array.isArray(value)) {
    throw AppError.badRequest("Field must be an array of strings.", { field: key }, "SUPPLIER_ARRAY_FIELD_INVALID");
  }
  const values = value.map((item) => parseRequiredText(item, key));
  return { [key]: values } as unknown as Record<Key, readonly string[]>;
}

export const autoDSRouter = createAutoDSRouter();
