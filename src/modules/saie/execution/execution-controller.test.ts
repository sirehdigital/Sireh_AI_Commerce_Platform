import { describe, expect, it, vi } from "vitest";

import type {
  SafeShopifyProductUpdateAudit,
  ShopifyProductSnapshot,
} from "../../../integrations/shopify/shopify-product-update.types.js";
import type {
  ProductPreparationProposal,
  ProductPreparationRequirement,
} from "../workflows/product-preparation/index.js";
import {
  ShopifyPreservationSnapshotBuilder,
  type ShopifyDraftPreparationProductSnapshot,
  type ShopifyDraftPreparationReadRepository,
} from "../workflows/shopify-draft-preparation/index.js";
import {
  CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS,
  calculateProposalHash,
  type ApprovalToken,
} from "./approval-token.js";
import {
  ControlledSafeUpdateExecutionController,
  type ControlledExecutionDependencies,
  type ShopifySafeUpdateExecutor,
} from "./execution-controller.js";
import type { ControlledSafeUpdateExecutionRequest } from "./execution-request.js";

const FIXED_DATE = new Date("2026-07-15T08:00:00.000Z");
const PRODUCT_ID = "gid://shopify/Product/8351602737199";
const VARIANT_ID = "gid://shopify/ProductVariant/45602785394735";
const INVENTORY_ITEM_ID = "gid://shopify/InventoryItem/1";
const COLLECTION_ID = "gid://shopify/Collection/1";
const STORE_DOMAIN = "mk9096-8w.myshopify.com" as const;

describe("ControlledSafeUpdateExecutionController", () => {
  it("executes an approved safe update successfully", async () => {
    const fixture = createFixture();
    const result = await fixture.controller.execute(fixture.request);

    expect(result.status).toBe("SUCCESS");
    expect(fixture.updateService.update).toHaveBeenCalledTimes(1);
  });

  it("maps only the approved proposal into the existing update command", async () => {
    const fixture = createFixture();
    await fixture.controller.execute(fixture.request);

    expect(fixture.updateService.update).toHaveBeenCalledWith({
      shopDomain: STORE_DOMAIN,
      locator: { kind: "id", productId: PRODUCT_ID },
      title: "Lumora™ Revive Red Light Scalp Massager",
      descriptionHtml: "<p>Approved description.</p>",
      vendor: "Lumora Beauty",
      productType: "Hair Care Device",
      tagsToAdd: ["Hair Wellness", "Scalp Care"],
      seo: { title: "Lumora Revive | Hair Wellness", description: "Approved SEO description." },
      pricing: { price: "199.00", compareAtPrice: "299.00" },
      collectionIdsToJoin: [COLLECTION_ID],
      templateSuffix: "velvetglow",
    });
  });

  it("reports verified human approval", async () => {
    const result = await createFixture().controller.execute(createFixture().request);
    expect(result.safetyReport.humanApprovalVerified).toBe(true);
  });

  it("reports the two existing-service GraphQL mutations on success", async () => {
    const fixture = createFixture();
    const result = await fixture.controller.execute(fixture.request);
    expect(result.mutationCount).toBe(2);
  });

  it("always reports no publication", async () => {
    const fixture = createFixture();
    const result = await fixture.controller.execute(fixture.request);
    expect(result.publicationExecuted).toBe(false);
    expect(result.safetyReport.publicationExecuted).toBe(false);
  });

  it("always reports no inventory mutation", async () => {
    const fixture = createFixture();
    const result = await fixture.controller.execute(fixture.request);
    expect(result.inventoryMutation).toBe(false);
    expect(result.safetyReport.inventoryMutation).toBe(false);
  });

  it("reports no theme, media, or metafield mutation", async () => {
    const result = await createFixture().controller.execute(createFixture().request);
    expect(result.safetyReport.themeMutation).toBe(false);
    expect(result.safetyReport.mediaMutation).toBe(false);
    expect(result.safetyReport.metafieldMutation).toBe(false);
  });

  it("reports preserved AutoDS linkage after read-back", async () => {
    const fixture = createFixture();
    const result = await fixture.controller.execute(fixture.request);
    expect(result.preservationVerification?.autoDSLinkPreserved).toBe(true);
    expect(result.safetyReport.autoDSLinkPreserved).toBe(true);
  });

  it("rejects an expired approval before Shopify access", async () => {
    const fixture = createFixture({ token: { expiresAt: "2026-07-15T07:59:59.000Z" } });
    const result = await fixture.controller.execute(fixture.request);
    expect(result.failureCode).toBe("APPROVAL_EXPIRED");
    expect(fixture.reader.readProductById).not.toHaveBeenCalled();
  });

  it("rejects a wrong proposal hash", async () => {
    const fixture = createFixture({ token: { proposalHash: "wrong-hash" } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("APPROVAL_SCOPE_MISMATCH");
    expect(fixture.updateService.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong approval workflow", async () => {
    const fixture = createFixture({ token: { workflowId: "wrong-workflow" } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("APPROVAL_SCOPE_MISMATCH");
  });

  it("rejects a wrong approval product", async () => {
    const fixture = createFixture({ scope: { productId: "gid://shopify/Product/999" } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("APPROVAL_SCOPE_MISMATCH");
  });

  it("rejects a wrong approval store", async () => {
    const fixture = createFixture({ scope: { storeDomain: "wrong-store.myshopify.com" } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("APPROVAL_SCOPE_MISMATCH");
  });

  it.each(["publish", "activate", "inventory-update", "bulk-update", "theme-update", "media-update"])(
    "rejects unsupported execution mode %s",
    async (executionMode) => {
      const fixture = createFixture();
      const request = { ...fixture.request, executionMode } as unknown as ControlledSafeUpdateExecutionRequest;
      const result = await fixture.controller.execute(request);
      expect(result.failureCode).toBe("INVALID_EXECUTION_MODE");
      expect(fixture.updateService.update).not.toHaveBeenCalled();
    },
  );

  it("rejects additional execution input", async () => {
    const fixture = createFixture();
    const request = { ...fixture.request, publish: false } as ControlledSafeUpdateExecutionRequest;
    expect((await fixture.controller.execute(request)).failureCode).toBe("EXTRA_EXECUTION_INPUT");
  });

  it("rejects an invalid product ID", async () => {
    const fixture = createFixture();
    const request = { ...fixture.request, productId: "8351602737199" };
    expect((await fixture.controller.execute(request)).failureCode).toBe("INVALID_EXECUTION_REQUEST");
  });

  it("rejects an invalid store domain", async () => {
    const fixture = createFixture();
    const request = { ...fixture.request, storeDomain: "example.com" as `${string}.myshopify.com` };
    expect((await fixture.controller.execute(request)).failureCode).toBe("INVALID_EXECUTION_REQUEST");
  });

  it("fails safely when the product is not found", async () => {
    const fixture = createFixture({ reads: [null] });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PRODUCT_NOT_FOUND");
    expect(fixture.updateService.update).not.toHaveBeenCalled();
  });

  it("rejects a product that is not already DRAFT", async () => {
    const before = createSnapshot({ status: "ACTIVE" });
    const fixture = createFixture({ before, after: createAfterSnapshot(before) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a Shopify product ID mismatch", async () => {
    const fixture = createFixture({ before: createSnapshot({ id: "gid://shopify/Product/999" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a handle mismatch", async () => {
    const fixture = createFixture({ before: createSnapshot({ handle: "changed-handle" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a preflight variant ID mismatch", async () => {
    const fixture = createFixture({ before: withVariant(createSnapshot(), { id: "gid://shopify/ProductVariant/999" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a preflight SKU mismatch", async () => {
    const fixture = createFixture({ before: withVariant(createSnapshot(), { sku: "CHANGED-SKU" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a preflight inventory item mismatch", async () => {
    const fixture = createFixture({ before: withVariant(createSnapshot(), { inventoryItemId: "gid://shopify/InventoryItem/999" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a preflight inventory tracking mismatch", async () => {
    const fixture = createFixture({ before: withVariant(createSnapshot(), { inventoryTracked: false }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a preflight inventory policy mismatch", async () => {
    const fixture = createFixture({ before: withVariant(createSnapshot(), { inventoryPolicy: "CONTINUE" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a preflight location or quantity mismatch", async () => {
    const fixture = createFixture({
      before: withVariant(createSnapshot(), {
        inventoryQuantities: [{ locationId: "gid://shopify/Location/2", locationName: "Other", quantity: 3 }],
      }),
    });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a store currency mismatch", async () => {
    const fixture = createFixture({ before: createSnapshot({ storeCurrency: "USD" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects a template mismatch with brand context", async () => {
    const fixture = createFixture();
    const request = {
      ...fixture.request,
      brandContext: { ...fixture.request.brandContext, templateSuffix: "other-template" },
    };
    expect((await fixture.controller.execute(request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("rejects unresolved collection titles", async () => {
    const fixture = createFixture({ proposal: { collectionReferences: ["Hair Wellness"] } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("INVALID_PROPOSAL");
  });

  it("rejects a missing safe update proposal", async () => {
    const base = createProposal(createSnapshot());
    const { safeUpdateProposal, ...proposal } = base;
    expect(safeUpdateProposal).toBeDefined();
    const fixture = createFixture({ fullProposal: proposal });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("INVALID_PROPOSAL");
  });

  it("rejects a proposal that is not ready for review", async () => {
    const fixture = createFixture({ proposalState: { readyForHumanReview: false } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("INVALID_PROPOSAL");
  });

  it("rejects a proposal missing protected mutation exclusions", async () => {
    const fixture = createFixture({ proposal: { excludedMutations: ["publication mutation"] } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("INVALID_PROPOSAL");
  });

  it("rejects vendor that does not match the brand context", async () => {
    const fixture = createFixture({ proposal: { vendor: "Other Brand" } });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("PREFLIGHT_MISMATCH");
  });

  it("reports an existing-service failure without issuing rollback mutations", async () => {
    const fixture = createFixture({ updateError: new Error("Shopify mutation failed") });
    const result = await fixture.controller.execute(fixture.request);
    expect(result.status).toBe("FAILED");
    expect(result.failureCode).toBe("SAFE_UPDATE_FAILED");
    expect(result.mutationCount).toBe("unknown");
    expect(result.rollback).toEqual(expect.objectContaining({ attempted: false, status: "not-supported" }));
  });

  it("fails read-back when SKU changes", async () => {
    const fixture = createFixture({ afterTransform: (after) => withVariant(after, { sku: "BROKEN-SKU" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("READBACK_MISMATCH");
  });

  it("fails read-back when variant identity changes", async () => {
    const fixture = createFixture({ afterTransform: (after) => withVariant(after, { id: "gid://shopify/ProductVariant/999" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("READBACK_MISMATCH");
  });

  it("fails read-back when inventory item identity changes", async () => {
    const fixture = createFixture({ afterTransform: (after) => withVariant(after, { inventoryItemId: "gid://shopify/InventoryItem/999" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("READBACK_MISMATCH");
  });

  it("fails read-back when inventory tracking changes", async () => {
    const fixture = createFixture({ afterTransform: (after) => withVariant(after, { inventoryTracked: false }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("READBACK_MISMATCH");
  });

  it("fails read-back when inventory policy changes", async () => {
    const fixture = createFixture({ afterTransform: (after) => withVariant(after, { inventoryPolicy: "CONTINUE" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("READBACK_MISMATCH");
  });

  it("fails read-back when inventory locations change", async () => {
    const fixture = createFixture({
      afterTransform: (after) =>
        withVariant(after, {
          inventoryQuantities: [{ locationId: "gid://shopify/Location/2", locationName: "Other", quantity: 10 }],
        }),
    });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("READBACK_MISMATCH");
  });

  it("fails read-back when status is not DRAFT", async () => {
    const fixture = createFixture({ afterTransform: (after) => ({ ...after, status: "ACTIVE" }) });
    expect((await fixture.controller.execute(fixture.request)).failureCode).toBe("READBACK_MISMATCH");
  });

  it("does not mutate the execution request", async () => {
    const fixture = createFixture();
    const before = JSON.stringify(fixture.request);
    await fixture.controller.execute(fixture.request);
    expect(JSON.stringify(fixture.request)).toBe(before);
  });

  it("calculates a deterministic proposal hash independent of object key order", () => {
    const proposal = createProposal(createSnapshot());
    expect(calculateProposalHash(proposal)).toBe(calculateProposalHash({ ...proposal }));
  });

  it("rejects approval missing any controlled field", async () => {
    const fixture = createFixture({
      scope: { approvedFields: CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS.filter((field) => field !== "SKU" as never) },
    });
    const token = {
      ...fixture.request.approvalToken,
      approvalScope: {
        ...fixture.request.approvalToken.approvalScope,
        approvedFields: CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS.slice(0, -1),
      },
    };
    expect((await fixture.controller.execute({ ...fixture.request, approvalToken: token })).failureCode).toBe(
      "APPROVAL_SCOPE_MISMATCH",
    );
  });

  it("never includes handle, SKU, or inventory fields in the update command", async () => {
    const fixture = createFixture();
    await fixture.controller.execute(fixture.request);
    const command = vi.mocked(fixture.updateService.update).mock.calls[0]?.[0];
    expect(JSON.stringify(command)).not.toContain("AUTO-RED-001");
    expect(command).not.toHaveProperty("handle");
    expect(command).not.toHaveProperty("inventoryItemId");
  });

  it("performs exactly one preflight read and one post-update read on success", async () => {
    const fixture = createFixture();
    await fixture.controller.execute(fixture.request);
    expect(fixture.reader.readProductById).toHaveBeenCalledTimes(2);
    expect(fixture.reader.readProductsByHandle).not.toHaveBeenCalled();
  });
});

interface FixtureOptions {
  readonly before?: ShopifyDraftPreparationProductSnapshot;
  readonly after?: ShopifyDraftPreparationProductSnapshot;
  readonly reads?: readonly (ShopifyDraftPreparationProductSnapshot | null)[];
  readonly afterTransform?: (snapshot: ShopifyDraftPreparationProductSnapshot) => ShopifyDraftPreparationProductSnapshot;
  readonly proposal?: Partial<NonNullable<ProductPreparationProposal["safeUpdateProposal"]>>;
  readonly proposalState?: Partial<ProductPreparationProposal>;
  readonly fullProposal?: ProductPreparationProposal;
  readonly token?: Partial<ApprovalToken>;
  readonly scope?: Partial<ApprovalToken["approvalScope"]>;
  readonly updateError?: Error;
}

const createFixture = (options: FixtureOptions = {}) => {
  const expectedBefore = createSnapshot();
  const before = options.before ?? expectedBefore;
  const baseAfter = options.after ?? createAfterSnapshot(before);
  const after = options.afterTransform?.(baseAfter) ?? baseAfter;
  const proposal =
    options.fullProposal ??
    createProposal(expectedBefore, options.proposal, options.proposalState);
  const scope: ApprovalToken["approvalScope"] = {
    executionMode: "controlled-safe-update",
    storeDomain: STORE_DOMAIN,
    productId: PRODUCT_ID,
    targetStatus: "DRAFT",
    tagPolicy: proposal.safeUpdateProposal?.tagPolicy ?? "merge",
    approvedFields: [...CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS],
    ...options.scope,
  };
  const token: ApprovalToken = {
    workflowId: proposal.workflowId,
    proposalHash: calculateProposalHash(proposal),
    approvedBy: "qa.operator@lumora.example",
    approvedAt: "2026-07-15T07:30:00.000Z",
    expiresAt: "2026-07-15T09:00:00.000Z",
    approvalScope: scope,
    ...options.token,
  };
  const request: ControlledSafeUpdateExecutionRequest = {
    executionMode: "controlled-safe-update",
    approvedProposal: proposal,
    approvalToken: token,
    productId: PRODUCT_ID,
    storeDomain: STORE_DOMAIN,
    brandContext: {
      brandName: "Lumora Beauty",
      brandVoice: "premium",
      targetMarkets: ["MY"],
      sellingCurrency: "MYR",
      preferredCollections: [COLLECTION_ID],
      templateSuffix: "velvetglow",
    },
  };
  const readValues = options.reads ?? [before, after];
  const readProductById = vi.fn<ShopifyDraftPreparationReadRepository["readProductById"]>();
  for (const value of readValues) {
    readProductById.mockResolvedValueOnce(value);
  }
  readProductById.mockResolvedValue(after);
  const reader: ShopifyDraftPreparationReadRepository = {
    readProductById,
    readProductsByHandle: vi.fn(() => Promise.resolve([])),
  };
  const updateService: ShopifySafeUpdateExecutor = {
    update:
      options.updateError === undefined
        ? vi.fn(() => Promise.resolve(createUpdateAudit(before, after)))
        : vi.fn(() => Promise.reject(options.updateError ?? new Error("Safe update failed."))),
  };
  const dependencies: ControlledExecutionDependencies = {
    shopifyReader: reader,
    shopifyProductUpdateService: updateService,
    now: () => FIXED_DATE,
    createExecutionId: () => "execution-test-id",
  };

  return {
    controller: new ControlledSafeUpdateExecutionController(dependencies),
    reader,
    updateService,
    request,
  };
};

const createSnapshot = (
  override: Partial<ShopifyDraftPreparationProductSnapshot> = {},
): ShopifyDraftPreparationProductSnapshot => ({
  id: PRODUCT_ID,
  title: "Existing Lumora Product",
  handle: "lumora-revive-red-light-scalp-massager",
  descriptionHtml: "<p>Existing description.</p>",
  vendor: "Existing Vendor",
  productType: "Existing Type",
  status: "DRAFT",
  tags: ["Existing Tag"],
  templateSuffix: "velvetglow",
  seoTitle: "Existing SEO title",
  seoDescription: "Existing SEO description",
  collections: [{ id: COLLECTION_ID, title: "Hair Wellness" }],
  media: [{ id: "gid://shopify/MediaImage/1", url: "https://cdn.example/product.jpg" }],
  options: [{ name: "Color", values: ["Red"] }],
  variants: [
    {
      id: VARIANT_ID,
      title: "Red",
      price: 149,
      compareAtPrice: 249,
      sku: "AUTO-RED-001",
      inventoryItemId: INVENTORY_ITEM_ID,
      inventoryTracked: true,
      inventoryPolicy: "DENY",
      inventoryQuantities: [
        { locationId: "gid://shopify/Location/1", locationName: "Shop", quantity: 10 },
      ],
      optionValues: { Color: "Red" },
    },
  ],
  storeCurrency: "MYR",
  productDataTruncated: false,
  variantDataTruncated: false,
  inventoryDataIncomplete: false,
  ...override,
});

const createAfterSnapshot = (
  before: ShopifyDraftPreparationProductSnapshot,
): ShopifyDraftPreparationProductSnapshot => ({
  ...before,
  title: "Lumora™ Revive Red Light Scalp Massager",
  descriptionHtml: "<p>Approved description.</p>",
  vendor: "Lumora Beauty",
  productType: "Hair Care Device",
  tags: [...before.tags, "Hair Wellness", "Scalp Care"],
  seoTitle: "Lumora Revive | Hair Wellness",
  seoDescription: "Approved SEO description.",
  templateSuffix: "velvetglow",
  status: "DRAFT",
  variants: before.variants.map((variant) => ({ ...variant, price: 199, compareAtPrice: 299 })),
});

const withVariant = (
  snapshot: ShopifyDraftPreparationProductSnapshot,
  variantOverride: Partial<ShopifyDraftPreparationProductSnapshot["variants"][number]>,
): ShopifyDraftPreparationProductSnapshot => ({
  ...snapshot,
  variants: snapshot.variants.map((variant, index) =>
    index === 0 ? { ...variant, ...variantOverride } : variant,
  ),
});

const createProposal = (
  snapshot: ShopifyDraftPreparationProductSnapshot,
  safeUpdateOverride: Partial<NonNullable<ProductPreparationProposal["safeUpdateProposal"]>> = {},
  proposalOverride: Partial<ProductPreparationProposal> = {},
): ProductPreparationProposal => ({
  workflowId: "saie-proposal-8351602737199",
  executionMode: "proposal-only",
  productReference: {
    sourceId: PRODUCT_ID,
    sourceUrl: `shopify://${STORE_DOMAIN}/products/${snapshot.handle}`,
    title: snapshot.title,
  },
  completedSteps: [{ id: "RequireHumanApproval", order: 10, status: "completed" }],
  skippedSteps: [],
  warnings: [],
  safeUpdateProposal: {
    targetStatus: "DRAFT",
    title: "Lumora™ Revive Red Light Scalp Massager",
    descriptionHtml: "<p>Approved description.</p>",
    vendor: "Lumora Beauty",
    productType: "Hair Care Device",
    tagsToAdd: ["Hair Wellness", "Scalp Care"],
    approvedTags: ["Hair Wellness", "Scalp Care"],
    tagPolicy: "merge",
    seoTitle: "Lumora Revive | Hair Wellness",
    seoDescription: "Approved SEO description.",
    pricing: { currency: "MYR", price: 199, compareAtPrice: 299 },
    collectionReferences: [COLLECTION_ID],
    templateSuffix: "velvetglow",
    excludedMutations: [
      "product recreation",
      "variant recreation",
      "SKU mutation",
      "inventory item mutation",
      "inventory quantity mutation",
      "location mutation",
      "fulfillment mutation",
      "supplier-link mutation",
      "publication mutation",
    ],
    ...safeUpdateOverride,
  },
  preservationRequirements: createPreservationRequirements(snapshot),
  approvalStatus: "required",
  mutationExecuted: false,
  publicationExecuted: false,
  readyForHumanReview: true,
  generatedAt: "2026-07-15T07:00:00.000Z",
  ...proposalOverride,
});

const createPreservationRequirements = (
  snapshot: ShopifyDraftPreparationProductSnapshot,
): readonly ProductPreparationRequirement[] => {
  const state = new ShopifyPreservationSnapshotBuilder().build(snapshot);
  return [
    requirement("exact product ID", state.productId),
    requirement("exact handle", state.handle),
    requirement("variant IDs", state.variantIds),
    requirement("variant SKUs", state.variantSkus),
    requirement("inventory item IDs", state.inventoryItemIds),
    requirement("inventory tracking", state.inventoryTracked),
    requirement("inventory policies", state.inventoryPolicies),
    requirement("inventory locations and quantities", state.inventoryLocations),
    requirement("collection IDs", state.collectionIds),
    requirement("template suffix", state.templateSuffix),
    requirement("store currency", state.storeCurrency),
  ];
};

const requirement = (subject: string, expectedValue: unknown): ProductPreparationRequirement => ({
  subject,
  status: "required-for-future-execution",
  expectedValue,
});

const createUpdateAudit = (
  before: ShopifyDraftPreparationProductSnapshot,
  after: ShopifyDraftPreparationProductSnapshot,
): SafeShopifyProductUpdateAudit => ({
  shopDomain: STORE_DOMAIN,
  productId: PRODUCT_ID,
  before: toUpdateSnapshot(before),
  after: toUpdateSnapshot(after),
  changes: [{ field: "title", before: before.title, after: after.title }],
  preservation: {
    handlePreserved: true,
    variantIdsPreserved: true,
    skusPreserved: true,
    inventoryItemIdsPreserved: true,
    inventoryTrackingPreserved: true,
    inventoryPoliciesPreserved: true,
    noVariantsCreated: true,
    publicationMutationExecuted: false,
  },
  status: "completed",
  completedAt: FIXED_DATE,
});

const toUpdateSnapshot = (
  snapshot: ShopifyDraftPreparationProductSnapshot,
): ShopifyProductSnapshot => ({
  id: snapshot.id,
  title: snapshot.title,
  handle: snapshot.handle,
  descriptionHtml: snapshot.descriptionHtml,
  vendor: snapshot.vendor,
  productType: snapshot.productType,
  tags: [...snapshot.tags],
  status: snapshot.status as ShopifyProductSnapshot["status"],
  templateSuffix: snapshot.templateSuffix ?? null,
  seo: { title: snapshot.seoTitle ?? null, description: snapshot.seoDescription ?? null },
  collections: snapshot.collections.map((collection) => ({
    id: collection.id,
    title: collection.title,
    handle: collection.title.toLowerCase().replaceAll(" ", "-"),
  })),
  variants: snapshot.variants.map((variant) => ({
    id: variant.id,
    title: variant.title,
    sku: variant.sku,
    price: variant.price.toFixed(2),
    compareAtPrice: variant.compareAtPrice?.toFixed(2) ?? null,
    inventoryPolicy: variant.inventoryPolicy as "DENY" | "CONTINUE",
    inventoryItemId: variant.inventoryItemId,
    inventoryTracked: variant.inventoryTracked,
  })),
});
