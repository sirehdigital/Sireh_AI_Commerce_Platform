import { randomUUID } from "node:crypto";

import { Router, type Request, type RequestHandler } from "express";

import { CreateProductDraftService } from "../../product-draft/application/services/create-product-draft.service.js";
import { createPrismaProductDraftRepository } from "../../product-draft/infrastructure/repositories/prisma-product-draft.repository.js";
import { DEFAULT_TENANT_CONTEXT, ProcessLocalTenantRegistry } from "../../saie/application/index.js";
import { prismaApprovalRepository, prismaAuditRepository } from "../../saie/infrastructure/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AIProductImportPipelineService } from "../application/services/ai-product-import-pipeline.service.js";
import { ProductImportApiService, type ProductImportStartRequest } from "../application/services/product-import-api.service.js";
import type {
  ProductImportPersistenceStatus,
  ProductImportSourcePlatform,
} from "../domain/models/product-import.model.js";
import type { ProductImportRepository } from "../domain/repositories/product-import.repository.js";
import { prismaProductImportRepository } from "../infrastructure/repositories/prisma-product-import.repository.js";

const SOURCE_PLATFORMS = new Set(["generic", "autods", "winninghunter"]);
const STATUSES = new Set(["RECEIVED", "VALIDATING", "PROCESSING", "DRAFT_CREATED", "PENDING_APPROVAL", "COMPLETED", "FAILED"]);

export interface ProductImportRouterOptions {
  readonly service?: ProductImportApiService;
  readonly productImportRepository?: ProductImportRepository;
  readonly idGenerator?: () => string;
  readonly now?: () => Date;
}

export const createProductImportRouter = (options: ProductImportRouterOptions = {}): Router => {
  const router = Router();
  const service = options.service ?? createDefaultProductImportApiService(options);

  router.post("/", asyncHandler(async (request, response) => {
    const result = await service.startImport(parseStartRequest(request), resolveTenant(request));
    response.status(result.duplicate ? 200 : 201).json({ success: true, data: result });
  }));

  router.get("/", asyncHandler(async (request, response) => {
    const result = await service.listImports({
      ...optionalField("status", parseOptionalStatus(request.query.status)),
      ...optionalField("sourcePlatform", parseOptionalSourcePlatform(request.query.sourcePlatform)),
      ...optionalField("limit", parseOptionalInteger(request.query.limit, "limit")),
      ...optionalField("offset", parseOptionalInteger(request.query.offset, "offset")),
    }, resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  router.get("/:importId/status", asyncHandler(async (request, response) => {
    const result = await service.getImportStatus(parseImportId(readParam(request, "importId")), resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  router.post("/:importId/retry", asyncHandler(async (request, response) => {
    const result = await service.retryImport(
      parseImportId(readParam(request, "importId")),
      parseRequestedBy(request.body),
      resolveTenant(request),
      parseOptionalText((request.body as Record<string, unknown> | undefined)?.correlationId),
    );
    response.status(202).json({ success: true, data: result });
  }));

  router.get("/:importId", asyncHandler(async (request, response) => {
    const result = await service.getImport(parseImportId(readParam(request, "importId")), resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  return router;
};

function createDefaultProductImportApiService(options: ProductImportRouterOptions): ProductImportApiService {
  const productImportRepository = options.productImportRepository ?? prismaProductImportRepository;
  const now = options.now ?? (() => new Date());
  const idGenerator = options.idGenerator ?? randomUUID;
  const pipeline = new AIProductImportPipelineService({
    productImportRepository,
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

  return new ProductImportApiService(pipeline, productImportRepository, {
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

const parseStartRequest = (request: Request): ProductImportStartRequest => {
  const body = asRecord(request.body, "body");
  const payload = body.payload === undefined ? body : body.payload;

  return {
    sourcePlatform: parseSourcePlatform(body.sourcePlatform),
    payload,
    requestedBy: parseRequestedBy(body),
    forceReimport: body.forceReimport === true || body.force === true,
    ...optionalTextField("correlationId", body.correlationId),
  };
};

const parseRequestedBy = (body: unknown): string => {
  const record = typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return parseOptionalText(record.requestedBy) ?? "merchant-api";
};

const parseImportId = (value: string | undefined): string => {
  const importId = parseOptionalText(value);

  if (importId === undefined) {
    throw AppError.badRequest("Product import ID is required.", { field: "importId" }, "PRODUCT_IMPORT_ID_REQUIRED");
  }

  return importId;
};

const parseSourcePlatform = (value: unknown): ProductImportSourcePlatform => {
  const platform = parseOptionalText(value);

  if (platform === undefined || !SOURCE_PLATFORMS.has(platform)) {
    throw AppError.badRequest(
      "Product import source platform is invalid.",
      { field: "sourcePlatform" },
      "PRODUCT_IMPORT_SOURCE_PLATFORM_INVALID",
    );
  }

  return platform as ProductImportSourcePlatform;
};

const parseOptionalSourcePlatform = (value: unknown): ProductImportSourcePlatform | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return parseSourcePlatform(value);
};

const parseOptionalStatus = (value: unknown): ProductImportPersistenceStatus | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const status = parseOptionalText(value);
  if (status === undefined || !STATUSES.has(status)) {
    throw AppError.badRequest("Product import status is invalid.", { field: "status" }, "PRODUCT_IMPORT_STATUS_INVALID");
  }

  return status as ProductImportPersistenceStatus;
};

const parseOptionalInteger = (value: unknown, field: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const text = parseOptionalText(value);
  const parsed = text === undefined ? Number.NaN : Number.parseInt(text, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw AppError.badRequest("Query parameter must be a non-negative integer.", { field }, "PRODUCT_IMPORT_QUERY_INVALID");
  }

  return parsed;
};

const asRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw AppError.badRequest("Request body must be an object.", { field }, "PRODUCT_IMPORT_BODY_INVALID");
  }

  return value as Record<string, unknown>;
};

const parseOptionalHeader = (request: Request, name: string): string | undefined =>
  parseOptionalText(request.header(name));

const parseOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
};

const optionalTextField = <Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> => {
  const text = parseOptionalText(value);
  return text === undefined ? {} : ({ [key]: text } as Record<Key, string>);
};

const optionalField = <Key extends string, Value>(key: Key, value: Value | undefined): Partial<Record<Key, Value>> =>
  value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);

const readParam = (request: Request, key: string): string | undefined => {
  const value = request.params[key];
  return typeof value === "string" ? value : undefined;
};

export const productImportRouter = createProductImportRouter();
