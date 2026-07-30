import { randomUUID } from "node:crypto";

import { Router, type Request, type RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import type { ProductDraftRepository } from "../../product-draft/domain/repositories/product-draft.repository.js";
import { createPrismaProductDraftRepository } from "../../product-draft/infrastructure/repositories/prisma-product-draft.repository.js";
import { DEFAULT_TENANT_CONTEXT, ProcessLocalTenantRegistry } from "../../saie/application/index.js";
import { prismaApprovalRepository, prismaAuditRepository } from "../../saie/infrastructure/index.js";
import {
  ArtifactPreviewService,
  StorefrontFoundationService,
  StorefrontPlanningService,
  ThemeMappingService,
  type CreateStorefrontFoundationProjectInput,
  type CreateStorefrontProfileInput,
} from "../application/index.js";
import type { StorefrontProjectStatus } from "../domain/index.js";
import type { StorefrontRepository } from "../domain/repositories/index.js";
import { prismaStorefrontRepository } from "../infrastructure/index.js";

const PROJECT_STATUSES = new Set([
  "DRAFT",
  "PLANNING",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "READY_FOR_DEPLOYMENT",
  "FAILED",
  "CANCELLED",
]);

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

export interface StorefrontRouterOptions {
  readonly service?: StorefrontFoundationService;
  readonly planningService?: StorefrontPlanningService;
  readonly themeMappingService?: ThemeMappingService;
  readonly artifactPreviewService?: ArtifactPreviewService;
  readonly repository?: StorefrontRepository;
  readonly productDraftRepository?: ProductDraftRepository;
  readonly idGenerator?: () => string;
  readonly now?: () => Date;
}

export const createStorefrontRouter = (options: StorefrontRouterOptions = {}): Router => {
  const router = Router();
  const service = options.service ?? createDefaultService(options);
  const planningService = options.planningService ?? createDefaultPlanningService(options);
  const themeMappingService = options.themeMappingService ?? createDefaultThemeMappingService(options);
  const artifactPreviewService = options.artifactPreviewService ?? createDefaultArtifactPreviewService(options);

  router.post("/profiles", asyncHandler(async (request, response) => {
    const profile = await service.createProfile(parseCreateProfileInput(request), resolveTenant(request));
    response.status(201).json({ success: true, data: profile });
  }));

  router.get("/profiles", asyncHandler(async (request, response) => {
    const result = await service.listProfiles(resolveTenant(request));
    response.status(200).json({ success: true, data: result });
  }));

  router.post("/projects", asyncHandler(async (request, response) => {
    const project = await service.createProject(parseCreateProjectInput(request), resolveTenant(request));
    response.status(project.parentProjectId === undefined ? 201 : 202).json({ success: true, data: project });
  }));

  router.get("/projects", asyncHandler(async (request, response) => {
    const tenant = resolveTenant(request);
    const result = await service.listProjects({
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...optionalField("status", parseOptionalStatus(request.query.status)),
      ...optionalField("locale", parseOptionalText(request.query.locale)),
      ...optionalField("limit", parseOptionalInteger(request.query.limit, "limit")),
      ...optionalField("offset", parseOptionalInteger(request.query.offset, "offset")),
    });
    response.status(200).json({ success: true, data: result });
  }));

  router.get("/projects/:projectId/status", asyncHandler(async (request, response) => {
    const project = await service.getProject(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({
      success: true,
      data: {
        projectId: project.id,
        status: project.status,
        mode: project.mode,
        approvalId: project.approvalId ?? null,
        updatedAt: project.updatedAt,
        completedAt: project.completedAt ?? null,
      },
    });
  }));

  router.post("/projects/:projectId/plan", asyncHandler(async (request, response) => {
    const body = request.body === undefined || request.body === null ? {} : asRecord(request.body, "body");
    const project = await planningService.planProject({
      projectId: parseProjectId(request.params.projectId),
      ...(body.requestedBy === undefined ? {} : { requestedBy: parseRequiredText(body.requestedBy, "requestedBy") }),
      ...(body.correlationId === undefined ? {} : { correlationId: parseRequiredText(body.correlationId, "correlationId") }),
    }, resolveTenant(request));
    response.status(project.status === "FAILED" ? 202 : 200).json({ success: true, data: project });
  }));

  router.get("/projects/:projectId/plan", asyncHandler(async (request, response) => {
    const plan = await planningService.getPlan(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: plan });
  }));

  router.get("/projects/:projectId/planning-report", asyncHandler(async (request, response) => {
    const report = await planningService.getPlanningReport(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: report });
  }));

  router.post("/projects/:projectId/theme-mapping", asyncHandler(async (request, response) => {
    const body = request.body === undefined || request.body === null ? {} : asRecord(request.body, "body");
    const result = await themeMappingService.mapProject({
      projectId: parseProjectId(request.params.projectId),
      ...(body.requestedBy === undefined ? {} : { requestedBy: parseRequiredText(body.requestedBy, "requestedBy") }),
      ...(body.correlationId === undefined ? {} : { correlationId: parseRequiredText(body.correlationId, "correlationId") }),
    }, resolveTenant(request));
    response.status(result.validation.errors.length === 0 ? 200 : 202).json({ success: true, data: result });
  }));

  router.get("/projects/:projectId/theme-mapping", asyncHandler(async (request, response) => {
    const mapping = await themeMappingService.getThemeMapping(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: mapping });
  }));

  router.get("/projects/:projectId/theme-preview", asyncHandler(async (request, response) => {
    const preview = await themeMappingService.getThemePreview(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: preview });
  }));

  router.post("/projects/:projectId/artifacts", asyncHandler(async (request, response) => {
    const body = request.body === undefined || request.body === null ? {} : asRecord(request.body, "body");
    const result = await artifactPreviewService.generatePreview({
      projectId: parseProjectId(request.params.projectId),
      ...(body.requestedBy === undefined ? {} : { requestedBy: parseRequiredText(body.requestedBy, "requestedBy") }),
      ...(body.correlationId === undefined ? {} : { correlationId: parseRequiredText(body.correlationId, "correlationId") }),
    }, resolveTenant(request));
    response.status(result.generation.validation.errors.length === 0 ? 200 : 202).json({ success: true, data: result });
  }));

  router.get("/projects/:projectId/artifacts", asyncHandler(async (request, response) => {
    const artifacts = await artifactPreviewService.listArtifacts(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: artifacts });
  }));

  router.get("/projects/:projectId/artifact-bundle", asyncHandler(async (request, response) => {
    const bundle = await artifactPreviewService.getBundle(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: bundle });
  }));

  router.get("/projects/:projectId/artifact-validation", asyncHandler(async (request, response) => {
    const validation = await artifactPreviewService.getValidation(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: validation });
  }));

  router.patch("/projects/:projectId/status", asyncHandler(async (request, response) => {
    const project = await service.transitionProject(parseTransitionInput(request), resolveTenant(request));
    response.status(200).json({ success: true, data: project });
  }));

  router.get("/projects/:projectId", asyncHandler(async (request, response) => {
    const project = await service.getProject(parseProjectId(request.params.projectId), resolveTenant(request));
    response.status(200).json({ success: true, data: project });
  }));

  return router;
};

function createDefaultService(options: StorefrontRouterOptions): StorefrontFoundationService {
  const now = options.now ?? (() => new Date());
  const idGenerator = options.idGenerator ?? randomUUID;
  const repository = options.repository ?? prismaStorefrontRepository;
  return new StorefrontFoundationService({
    repository,
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
    now,
    idGenerator,
  });
}

function createDefaultPlanningService(options: StorefrontRouterOptions): StorefrontPlanningService {
  const now = options.now ?? (() => new Date());
  const idGenerator = options.idGenerator ?? randomUUID;
  return new StorefrontPlanningService({
    storefrontRepository: options.repository ?? prismaStorefrontRepository,
    productDraftRepository: options.productDraftRepository ?? createPrismaProductDraftRepository(DEFAULT_TENANT_CONTEXT),
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
    now,
    idGenerator,
  });
}

function createDefaultThemeMappingService(options: StorefrontRouterOptions): ThemeMappingService {
  const now = options.now ?? (() => new Date());
  const idGenerator = options.idGenerator ?? randomUUID;
  return new ThemeMappingService({
    storefrontRepository: options.repository ?? prismaStorefrontRepository,
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
    now,
    idGenerator,
  });
}

function createDefaultArtifactPreviewService(options: StorefrontRouterOptions): ArtifactPreviewService {
  const now = options.now ?? (() => new Date());
  const idGenerator = options.idGenerator ?? randomUUID;
  return new ArtifactPreviewService({
    storefrontRepository: options.repository ?? prismaStorefrontRepository,
    approvalRepository: prismaApprovalRepository,
    auditRepository: prismaAuditRepository,
    now,
    idGenerator,
  });
}

const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

function resolveTenant(request: Request) {
  const registry = new ProcessLocalTenantRegistry([DEFAULT_TENANT_CONTEXT]);
  return registry.resolveTenant({
    tenantId: parseOptionalHeader(request, "x-saie-tenant-id") ?? DEFAULT_TENANT_CONTEXT.tenantId,
    storeId: parseOptionalHeader(request, "x-saie-store-id") ?? DEFAULT_TENANT_CONTEXT.storeId,
    shopDomain: parseOptionalHeader(request, "x-saie-shop-domain"),
  });
}

function parseCreateProfileInput(request: Request): CreateStorefrontProfileInput {
  const body = asRecord(request.body, "body");
  return {
    brandName: parseRequiredText(body.brandName, "brandName"),
    brandPositioning: parseRequiredText(body.brandPositioning, "brandPositioning"),
    targetMarkets: parseStringArray(body.targetMarkets, "targetMarkets"),
    defaultLocale: parseRequiredText(body.defaultLocale, "defaultLocale"),
    ...(body.supportedLocales === undefined ? {} : { supportedLocales: parseStringArray(body.supportedLocales, "supportedLocales") }),
    currency: parseRequiredText(body.currency, "currency"),
    industry: parseRequiredText(body.industry, "industry"),
    ...(body.visualIdentity === undefined ? {} : { visualIdentity: parseStringArray(body.visualIdentity, "visualIdentity") }),
    ...(body.preferredColorPalette === undefined ? {} : { preferredColorPalette: parseStringArray(body.preferredColorPalette, "preferredColorPalette") }),
    ...optionalTextField("typographyDirection", body.typographyDirection),
    ...(body.toneOfVoice === undefined ? {} : { toneOfVoice: parseStringArray(body.toneOfVoice, "toneOfVoice") }),
    ...optionalTextField("photographyDirection", body.photographyDirection),
    ...(body.trustStyle === undefined ? {} : { trustStyle: parseStringArray(body.trustStyle, "trustStyle") }),
    ...(body.targetCustomer === undefined ? {} : { targetCustomer: parseStringArray(body.targetCustomer, "targetCustomer") }),
    ...(body.merchandisingPriorities === undefined ? {} : { merchandisingPriorities: parseStringArray(body.merchandisingPriorities, "merchandisingPriorities") }),
    ...(body.navigationPreferences === undefined ? {} : { navigationPreferences: parseStringArray(body.navigationPreferences, "navigationPreferences") }),
    ...(body.homepagePriorities === undefined ? {} : { homepagePriorities: parseStringArray(body.homepagePriorities, "homepagePriorities") }),
    ...(body.productPagePriorities === undefined ? {} : { productPagePriorities: parseStringArray(body.productPagePriorities, "productPagePriorities") }),
    ...(body.footerRequirements === undefined ? {} : { footerRequirements: parseStringArray(body.footerRequirements, "footerRequirements") }),
    ...(body.requestedBy === undefined ? {} : { requestedBy: parseRequiredText(body.requestedBy, "requestedBy") }),
    ...(body.correlationId === undefined ? {} : { correlationId: parseRequiredText(body.correlationId, "correlationId") }),
  };
}

function parseCreateProjectInput(request: Request): CreateStorefrontFoundationProjectInput {
  const body = asRecord(request.body, "body");
  const input: Mutable<CreateStorefrontFoundationProjectInput> = {
    profileId: parseRequiredText(body.profileId, "profileId"),
    mode: body.mode === "GENERATE_ARTIFACTS" ? "GENERATE_ARTIFACTS" : "PLAN_ONLY",
    force: body.force === true || body.forceRegeneration === true,
  };
  if (body.selectedProductDraftIds !== undefined) {
    input.selectedProductDraftIds = parseStringArray(body.selectedProductDraftIds, "selectedProductDraftIds");
  } else if (body.productDraftIds !== undefined) {
    input.selectedProductDraftIds = parseStringArray(body.productDraftIds, "productDraftIds");
  }
  if (body.locale !== undefined) {
    input.locale = parseRequiredText(body.locale, "locale");
  }
  if (body.markets !== undefined) {
    input.markets = parseStringArray(body.markets, "markets");
  }
  if (body.themeTarget !== undefined) {
    input.themeTarget = parseThemeTarget(body.themeTarget);
  }
  if (body.themeTargetReference !== undefined) {
    input.themeTargetReference = parseRequiredText(body.themeTargetReference, "themeTargetReference");
  }
  if (body.requestedBy !== undefined) {
    input.requestedBy = parseRequiredText(body.requestedBy, "requestedBy");
  }
  if (body.correlationId !== undefined) {
    input.correlationId = parseRequiredText(body.correlationId, "correlationId");
  }
  return input;
}

function parseTransitionInput(request: Request) {
  const body = asRecord(request.body, "body");
  return {
    projectId: parseProjectId(request.params.projectId),
    status: parseOptionalStatus(body.status) ?? parseRequiredText(body.status, "status") as StorefrontProjectStatus,
    ...(body.failureCode === undefined ? {} : { failureCode: parseRequiredText(body.failureCode, "failureCode") }),
    ...(body.failureMessage === undefined ? {} : { failureMessage: parseRequiredText(body.failureMessage, "failureMessage") }),
    ...(body.correlationId === undefined ? {} : { correlationId: parseRequiredText(body.correlationId, "correlationId") }),
  };
}

function parseThemeTarget(value: unknown): NonNullable<CreateStorefrontFoundationProjectInput["themeTarget"]> {
  const record = asRecord(value, "themeTarget");
  return {
    type: parseRequiredText(record.type, "themeTarget.type") as NonNullable<CreateStorefrontFoundationProjectInput["themeTarget"]>["type"],
    reference: parseRequiredText(record.reference, "themeTarget.reference"),
    ...optionalTextField("themeName", record.themeName),
  };
}

function parseProjectId(value: unknown): string {
  return parseRequiredText(value, "projectId");
}

function parseOptionalStatus(value: unknown): StorefrontProjectStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  const status = parseRequiredText(value, "status");
  if (!PROJECT_STATUSES.has(status)) {
    throw AppError.badRequest("Storefront project status is invalid.", { field: "status" }, "STOREFRONT_STATUS_INVALID");
  }
  return status as StorefrontProjectStatus;
}

function parseOptionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const text = parseRequiredText(value, field);
  const parsed = Number.parseInt(text, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw AppError.badRequest("Query parameter must be a non-negative integer.", { field }, "STOREFRONT_QUERY_INVALID");
  }
  return parsed;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw AppError.badRequest("Request body must be an object.", { field }, "STOREFRONT_BODY_INVALID");
  }
  return value as Record<string, unknown>;
}

function parseStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw AppError.badRequest("Field must be an array of strings.", { field }, "STOREFRONT_ARRAY_FIELD_INVALID");
  }
  return value.map((item) => parseRequiredText(item, field));
}

function parseRequiredText(value: unknown, field: string): string {
  const text = parseOptionalText(value);
  if (text === undefined) {
    throw AppError.badRequest("Required text field is missing.", { field }, "STOREFRONT_REQUIRED_FIELD_MISSING");
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

function optionalField<Key extends string, Value>(key: Key, value: Value | undefined): Partial<Record<Key, Value>> {
  return value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);
}

export const storefrontRouter = createStorefrontRouter();
