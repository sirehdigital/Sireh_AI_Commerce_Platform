import { randomUUID } from "node:crypto";

import { Router, type Request, type RequestHandler } from "express";

import { createPrismaProductDraftRepository } from "../../product-draft/infrastructure/repositories/prisma-product-draft.repository.js";
import { DEFAULT_TENANT_CONTEXT, ProcessLocalTenantRegistry } from "../../saie/application/index.js";
import { prismaApprovalRepository, prismaAuditRepository } from "../../saie/infrastructure/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { ProductMediaAssetType, ProductMediaJobMode, ProductMediaJobStatus, ProductMediaSource } from "../domain/models/index.js";
import type { ProductMediaRepository } from "../domain/repositories/index.js";
import { ProductMediaOrchestratorService, type ProductMediaStartRequest } from "../application/services/product-media-orchestrator.service.js";
import { DisabledProductMediaGenerationProvider } from "../infrastructure/providers/index.js";
import { prismaProductMediaRepository } from "../infrastructure/repositories/index.js";

const ASSET_TYPES = new Set([
  "PRODUCT_HERO",
  "PRODUCT_GALLERY",
  "LIFESTYLE",
  "BENEFIT_CARD",
  "INGREDIENT_CARD",
  "HOW_TO_USE",
  "FEATURE_HIGHLIGHT",
  "COLLECTION_TILE",
  "SOCIAL_SQUARE",
  "SOCIAL_VERTICAL",
  "AD_CREATIVE",
  "THUMBNAIL",
]);
const STATUSES = new Set(["DRAFT", "PLANNED", "VALIDATING", "READY_FOR_GENERATION", "GENERATING", "PARTIALLY_GENERATED", "GENERATED", "PENDING_REVIEW", "APPROVED", "REJECTED", "FAILED", "CANCELLED"]);

export interface ProductMediaRouterOptions {
  readonly service?: ProductMediaOrchestratorService;
  readonly repository?: ProductMediaRepository;
  readonly idGenerator?: () => string;
  readonly now?: () => Date;
}

export const createProductMediaRouter = (options: ProductMediaRouterOptions = {}): Router => {
  const router = Router();
  const repository = options.repository ?? prismaProductMediaRepository;
  const service = options.service ?? createDefaultService(repository, options);

  router.post("/jobs", asyncHandler(async (request, response) => {
    const result = await service.execute(parseStartRequest(request), resolveTenant(request));
    response.status(result.job.status === "FAILED" ? 202 : 201).json({ success: true, data: result });
  }));

  router.get("/jobs", asyncHandler(async (request, response) => {
    const tenant = resolveTenant(request);
    const result = await repository.listJobs({
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...optionalField("status", parseOptionalStatus(request.query.status)),
      ...optionalField("productDraftId", parseOptionalText(request.query.productDraftId)),
      ...optionalField("limit", parseOptionalInteger(request.query.limit, "limit")),
      ...optionalField("offset", parseOptionalInteger(request.query.offset, "offset")),
    });
    response.status(200).json({ success: true, data: result });
  }));

  router.get("/jobs/:jobId/status", asyncHandler(async (request, response) => {
    const result = await getTenantJob(repository, readParam(request, "jobId"), resolveTenant(request));
    response.status(200).json({ success: true, data: { id: result.id, status: result.status, failureCode: result.failureCode, updatedAt: result.updatedAt } });
  }));

  router.get("/jobs/:jobId", asyncHandler(async (request, response) => {
    const tenant = resolveTenant(request);
    const result = await repository.findJobWithAssets(readParam(request, "jobId"));
    if (result?.job.tenantId !== tenant.tenantId || result.job.storeId !== tenant.storeId) {
      throw AppError.notFound("Product media job was not found.", {}, "PRODUCT_MEDIA_JOB_NOT_FOUND");
    }
    response.status(200).json({ success: true, data: result });
  }));

  return router;
};

const createDefaultService = (
  repository: ProductMediaRepository,
  options: ProductMediaRouterOptions,
): ProductMediaOrchestratorService =>
  new ProductMediaOrchestratorService({
    productDraftRepositoryFactory: createPrismaProductDraftRepository,
    productMediaRepository: repository,
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
    provider: new DisabledProductMediaGenerationProvider(),
    idGenerator: options.idGenerator ?? randomUUID,
    ...optionalField("now", options.now),
  });

const getTenantJob = async (repository: ProductMediaRepository, jobId: string, tenant: ReturnType<typeof resolveTenant>) => {
  const job = await repository.findJobById(jobId);
  if (job?.tenantId !== tenant.tenantId || job.storeId !== tenant.storeId) {
    throw AppError.notFound("Product media job was not found.", { jobId }, "PRODUCT_MEDIA_JOB_NOT_FOUND");
  }
  return job;
};

const parseStartRequest = (request: Request): ProductMediaStartRequest => {
  const body = asRecord(request.body, "body");
  return {
    productDraftId: parseRequiredText(body.productDraftId, "productDraftId"),
    mode: parseMode(body.mode),
    requestedBy: parseOptionalText(body.requestedBy) ?? "merchant-api",
    ...optionalField("requestedAssetTypes", parseOptionalAssetTypes(body.requestedAssetTypes)),
    ...optionalField("channels", parseOptionalStringArray(body.channels, "channels")),
    ...optionalField("locale", parseOptionalText(body.locale)),
    ...optionalField("brandProfile", typeof body.brandProfile === "object" && body.brandProfile !== null ? body.brandProfile as ProductMediaStartRequest["brandProfile"] : undefined),
    ...optionalField("sourceMedia", parseOptionalSourceMedia(body.sourceMedia)),
    ...optionalField("providerId", parseOptionalText(body.providerId)),
    ...optionalField("correlationId", parseOptionalText(body.correlationId)),
    force: body.force === true,
  };
};

const parseMode = (value: unknown): ProductMediaJobMode => {
  const mode = parseOptionalText(value) ?? "PLAN_ONLY";
  if (mode !== "PLAN_ONLY" && mode !== "GENERATE") {
    throw AppError.badRequest("Product media mode is invalid.", { field: "mode" }, "PRODUCT_MEDIA_MODE_INVALID");
  }
  return mode;
};

const parseOptionalAssetTypes = (value: unknown): readonly ProductMediaAssetType[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw AppError.badRequest("requestedAssetTypes must be an array.", { field: "requestedAssetTypes" }, "PRODUCT_MEDIA_ASSET_TYPES_INVALID");
  }
  return value.map((entry) => {
    const text = parseRequiredText(entry, "requestedAssetTypes");
    if (!ASSET_TYPES.has(text)) {
      throw AppError.badRequest("requestedAssetTypes contains an unsupported asset type.", { assetType: text }, "PRODUCT_MEDIA_ASSET_TYPE_UNSUPPORTED");
    }
    return text as ProductMediaAssetType;
  });
};

const parseOptionalSourceMedia = (value: unknown): readonly ProductMediaSource[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw AppError.badRequest("sourceMedia must be an array.", { field: "sourceMedia" }, "PRODUCT_MEDIA_SOURCE_MEDIA_INVALID");
  }
  return value as readonly ProductMediaSource[];
};

const parseOptionalStatus = (value: unknown): ProductMediaJobStatus | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const status = parseRequiredText(value, "status");
  if (!STATUSES.has(status)) {
    throw AppError.badRequest("Product media status is invalid.", { status }, "PRODUCT_MEDIA_STATUS_INVALID");
  }
  return status as ProductMediaJobStatus;
};

const parseOptionalStringArray = (value: unknown, field: string): readonly string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw AppError.badRequest(`${field} must be an array.`, { field }, "PRODUCT_MEDIA_ARRAY_INVALID");
  }
  return value.map((entry) => parseRequiredText(entry, field));
};

const resolveTenant = (request: Request) => {
  const registry = new ProcessLocalTenantRegistry([DEFAULT_TENANT_CONTEXT]);
  return registry.resolveTenant({
    tenantId: parseOptionalText(request.header("x-saie-tenant-id")) ?? DEFAULT_TENANT_CONTEXT.tenantId,
    storeId: parseOptionalText(request.header("x-saie-store-id")) ?? DEFAULT_TENANT_CONTEXT.storeId,
    shopDomain: parseOptionalText(request.header("x-saie-shop-domain")),
  });
};

const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

const asRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw AppError.badRequest("Request body must be an object.", { field }, "PRODUCT_MEDIA_BODY_INVALID");
  }
  return value as Record<string, unknown>;
};

const parseRequiredText = (value: unknown, field: string): string => {
  const text = parseOptionalText(value);
  if (text === undefined) {
    throw AppError.badRequest("A required text field is missing.", { field }, "PRODUCT_MEDIA_REQUIRED_FIELD_MISSING");
  }
  return text;
};

const parseOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
};

const parseOptionalInteger = (value: unknown, field: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(parseRequiredText(value, field), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw AppError.badRequest("Query parameter must be a non-negative integer.", { field }, "PRODUCT_MEDIA_QUERY_INVALID");
  }
  return parsed;
};

const optionalField = <Key extends string, Value>(key: Key, value: Value | undefined): Partial<Record<Key, Value>> =>
  value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);

const readParam = (request: Request, key: string): string => parseRequiredText(request.params[key], key);

export const productMediaRouter = createProductMediaRouter();
