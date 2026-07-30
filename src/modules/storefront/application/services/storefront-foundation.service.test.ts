import { describe, expect, it } from "vitest";

import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { InMemoryStorefrontRepository } from "../../infrastructure/index.js";
import { StorefrontFoundationService } from "./storefront-foundation.service.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T09:00:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `id-${(id += 1).toString().padStart(3, "0")}`;
};

const createService = () => {
  const repository = new InMemoryStorefrontRepository();
  const approvalRepository = new InMemoryApprovalRepository([]);
  const auditRepository = new InMemoryAuditRepository();
  const service = new StorefrontFoundationService({
    repository,
    approvalRepository,
    auditRepository,
    now: () => now,
    idGenerator: idGenerator(),
  });
  return { service, repository, approvalRepository, auditRepository };
};

const profileInput = {
  brandName: "Lumora Beauty",
  brandPositioning: "Premium skincare inspired by nature.",
  targetMarkets: ["US", "MY"],
  defaultLocale: "en-US",
  supportedLocales: ["en-US"],
  currency: "USD",
  industry: "beauty",
  visualIdentity: ["cream", "soft gold", "olive green"],
  trustStyle: ["Fast Shipping", "Secure Checkout", "30-Day Satisfaction"],
};

describe("StorefrontFoundationService", () => {
  it("creates a StorefrontProfile with tenant and store isolation", async () => {
    const { service, auditRepository } = createService();

    const profile = await service.createProfile(profileInput, tenant);

    expect(profile).toMatchObject({
      id: "storefront-profile:id-001",
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      brandName: "Lumora Beauty",
      defaultLocale: "en-US",
      currency: "USD",
    });
    expect(auditRepository.list(tenant)).toHaveLength(1);
  });

  it("rejects malformed profile input using AppError conventions", async () => {
    const { service } = createService();

    await expect(service.createProfile({ ...profileInput, brandName: " " }, tenant)).rejects.toMatchObject({
      code: "STOREFRONT_REQUIRED_FIELD_MISSING",
      statusCode: 400,
    });
    await expect(service.createProfile({ ...profileInput, targetMarkets: [] }, tenant)).rejects.toMatchObject({
      code: "STOREFRONT_REQUIRED_LIST_EMPTY",
      statusCode: 400,
    });
  });

  it("creates a PLAN_ONLY project ending in PENDING_REVIEW with approval and audit records", async () => {
    const { service, approvalRepository, auditRepository } = createService();
    const profile = await service.createProfile(profileInput, tenant);

    const project = await service.createProject({
      profileId: profile.id,
      selectedProductDraftIds: ["draft-1", "draft-2"],
      requestedBy: "merchant",
    }, tenant);

    expect(project).toMatchObject({
      status: "PENDING_REVIEW",
      mode: "PLAN_ONLY",
      brandName: "Lumora Beauty",
      selectedProductDraftIds: ["draft-1", "draft-2"],
    });
    expect(project.approvalId).toEqual("approval:storefront-project:id-002");
    expect(approvalRepository.findById(tenant, project.approvalId ?? "")).toMatchObject({
      status: "pending",
      requiresHumanApproval: true,
      executionEnabled: false,
    });
    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toContain("storefront.project.pending_review");
  });

  it("defaults project execution to PLAN_ONLY and blocks active artifact generation", async () => {
    const { service } = createService();
    const profile = await service.createProfile(profileInput, tenant);

    await expect(service.createProject({ profileId: profile.id, mode: "GENERATE_ARTIFACTS" }, tenant)).rejects.toMatchObject({
      code: "STOREFRONT_MODE_NOT_ACTIVE",
      statusCode: 400,
    });
  });

  it("replays duplicate project requests by idempotency key", async () => {
    const { service, repository } = createService();
    const profile = await service.createProfile(profileInput, tenant);

    const first = await service.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-a"] }, tenant);
    const second = await service.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-a"] }, tenant);

    expect(second.id).toBe(first.id);
    await expect(repository.listProjects({ tenantId: tenant.tenantId, storeId: tenant.storeId })).resolves.toMatchObject({ total: 1 });
  });

  it("supports forced re-import without overwriting the prior project", async () => {
    const { service, repository } = createService();
    const profile = await service.createProfile(profileInput, tenant);

    const first = await service.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-a"] }, tenant);
    const forced = await service.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-a"], force: true }, tenant);

    expect(forced.id).not.toBe(first.id);
    expect(forced.parentProjectId).toBe(first.id);
    await expect(repository.listProjects({ tenantId: tenant.tenantId, storeId: tenant.storeId })).resolves.toMatchObject({ total: 2 });
  });

  it("enforces tenant isolation when retrieving projects", async () => {
    const { service } = createService();
    const profile = await service.createProfile(profileInput, tenant);
    const project = await service.createProject({ profileId: profile.id }, tenant);

    await expect(service.getProject(project.id, { ...tenant, storeId: "other-store" })).rejects.toMatchObject({
      code: "STOREFRONT_PROJECT_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("supports approved foundation lifecycle transitions only", async () => {
    const { service } = createService();
    const profile = await service.createProfile(profileInput, tenant);
    const project = await service.createProject({ profileId: profile.id }, tenant);

    const approved = await service.transitionProject({ projectId: project.id, status: "APPROVED" }, tenant);
    const ready = await service.transitionProject({ projectId: project.id, status: "READY_FOR_DEPLOYMENT" }, tenant);

    expect(approved.status).toBe("APPROVED");
    expect(ready.status).toBe("READY_FOR_DEPLOYMENT");
    await expect(service.transitionProject({ projectId: project.id, status: "PENDING_REVIEW" }, tenant)).rejects.toMatchObject({
      code: "STOREFRONT_STATUS_TRANSITION_INVALID",
      statusCode: 409,
    });
  });
});
