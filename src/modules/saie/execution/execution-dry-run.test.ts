import { describe, expect, it, vi } from "vitest";

import type { SafeShopifyProductUpdateCommand } from "../../../integrations/shopify/shopify-product-update.types.js";
import type { ShopifyDraftPreparationProductSnapshot, ShopifyDraftPreparationReadRepository } from "../workflows/shopify-draft-preparation/index.js";
import { REVIEW_ONLY_APPROVER } from "./approval-token.js";
import { ControlledSafeUpdateExecutionController } from "./execution-controller.js";
import { ControlledExecutionDryRun } from "./execution-dry-run.js";
import type { ControlledExecutionDryRunInput } from "./execution-dry-run.types.js";

const NOW = new Date("2026-07-15T09:00:00.000Z");
const STORE = "mk9096-8w.myshopify.com" as const;
const PRODUCT_ID = "gid://shopify/Product/8351602737199";
const COLLECTION_ID = "gid://shopify/Collection/320140967983";

describe("ControlledExecutionDryRun", () => {
  it("builds a complete mutation-ready review request without mutation", async () => {
    const fixture = createFixture();
    const result = await fixture.dryRun.prepare(fixture.input);

    expect(result.preflightReport.passed).toBe(true);
    expect(result.mutationReadyExecutionRequest.productId).toBe(PRODUCT_ID);
    expect(result.safetyReport.shopifyMutationExecuted).toBe(false);
    expect(fixture.reader.readProductById).toHaveBeenCalledTimes(1);
  });

  it("computes a deterministic SHA-256 proposal hash", async () => {
    const first = await createFixture().dryRun.prepare(createFixture().input);
    const second = await createFixture().dryRun.prepare(createFixture().input);

    expect(first.proposalHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(second.proposalHash).toBe(first.proposalHash);
  });

  it("changes the proposal hash when the tag policy changes", async () => {
    const mergeFixture = createFixture();
    const exactFixture = createFixture();
    const merge = await mergeFixture.dryRun.prepare(mergeFixture.input);
    const exact = await exactFixture.dryRun.prepare({
      ...exactFixture.input,
      tagPolicy: "exact-approved-set",
    });

    expect(exact.proposalHash).not.toBe(merge.proposalHash);
  });

  it("creates a short-lived review-only token", async () => {
    const fixture = createFixture();
    const result = await fixture.dryRun.prepare(fixture.input);

    expect(result.approvalToken.approvedBy).toBe(REVIEW_ONLY_APPROVER);
    expect(Date.parse(result.expiresAt) - Date.parse(result.generatedAt)).toBe(300_000);
    expect(result.safetyReport.reviewTokenExecutable).toBe(false);
    expect(result.approvalToken.approvalScope.tagPolicy).toBe("merge");
  });

  it("previews exact tag removals and blocks the merge-only execution service", async () => {
    const fixture = createFixture({
      snapshot: createSnapshot({
        tags: ["Lumora Beauty", "Hair Wellness", "Hair Growth", "Red Light Therapy"],
      }),
    });
    const result = await fixture.dryRun.prepare({
      ...fixture.input,
      approvedTags: ["Lumora Beauty", "Hair Wellness", "Self-Care"],
      tagPolicy: "exact-approved-set",
    });
    const update = vi.fn(() => Promise.reject(new Error("must not execute")));
    const controller = new ControlledSafeUpdateExecutionController({
      shopifyReader: fixture.reader,
      shopifyProductUpdateService: { update },
      now: () => NOW,
    });
    const execution = await controller.execute({
      ...result.mutationReadyExecutionRequest,
      approvalToken: {
        ...result.approvalToken,
        approvedBy: "qa.operator@lumora.example",
      },
    });

    expect(result.tagReconciliation).toMatchObject({
      policy: "exact-approved-set",
      tagsToAdd: ["Self-Care"],
      tagsToRemove: ["Hair Growth", "Red Light Therapy"],
      finalExpectedTags: ["Hair Wellness", "Lumora Beauty", "Self-Care"],
      executionSupportedByMergeOnlyService: false,
    });
    expect(result.preflightReport.executionBlockedByTagPolicy).toBe(true);
    expect(result.safetyReport.executionBlocked).toBe(true);
    expect(execution.failureCode).toBe("TAG_POLICY_UNSUPPORTED");
    expect(update).not.toHaveBeenCalled();
  });

  it("records malformed media alt text as non-blocking without enabling media mutation", async () => {
    const fixture = createFixture({
      snapshot: createSnapshot({
        media: [
          { id: "gid://shopify/MediaImage/1", url: "https://cdn.example/1.jpg", altText: "umora device front" },
          { id: "gid://shopify/MediaImage/2", url: "https://cdn.example/2.jpg", altText: "umora device side" },
        ],
      }),
    });
    const result = await fixture.dryRun.prepare(fixture.input);

    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatchObject({
      severity: "non-blocking",
      mediaMutationExcluded: true,
      requiredAction: "separate-approved-media-maintenance-workflow-or-manual-shopify-edit",
    });
    expect(result.safetyReport.mediaMutation).toBe(false);
  });

  it("ensures the review-only token cannot execute", async () => {
    const fixture = createFixture();
    const result = await fixture.dryRun.prepare(fixture.input);
    const update = vi.fn(() => Promise.reject(new Error("must not execute")));
    const controller = new ControlledSafeUpdateExecutionController({
      shopifyReader: fixture.reader,
      shopifyProductUpdateService: { update },
      now: () => NOW,
      createExecutionId: () => "dry-run-test",
    });

    const execution = await controller.execute(result.mutationReadyExecutionRequest);
    expect(execution.failureCode).toBe("INVALID_APPROVAL_TOKEN");
    expect(update).not.toHaveBeenCalled();
  });

  it("preserves exact variant, SKU, inventory item, policy, tracking, and location requirements", async () => {
    const result = await createFixture().dryRun.prepare(createFixture().input);
    const requirements = new Map(
      result.preservationRequirements.map((requirement) => [requirement.subject, requirement.expectedValue]),
    );

    expect(requirements.get("variant IDs")).toEqual(["gid://shopify/ProductVariant/45602785394735"]);
    expect(requirements.get("variant SKUs")).toEqual(["AUTO-RED-001"]);
    expect(requirements.get("inventory item IDs")).toEqual(["gid://shopify/InventoryItem/1"]);
    expect(requirements.get("inventory tracking")).toBe(true);
    expect(requirements.get("inventory policies")).toEqual(["DENY"]);
    expect(requirements.get("inventory locations and quantities")).toEqual([
      {
        locationId: "gid://shopify/Location/1",
        locationName: "Shop",
        quantities: { "gid://shopify/InventoryItem/1": 10 },
      },
    ]);
  });

  it("maps exact collection GIDs and pricing scope", async () => {
    const result = await createFixture().dryRun.prepare(createFixture().input);
    const proposal = result.approvedProposal.safeUpdateProposal;

    expect(proposal?.collectionReferences).toEqual([COLLECTION_ID]);
    expect(proposal?.pricing).toEqual({ currency: "MYR", price: 199, compareAtPrice: 299 });
    expect(result.preflightReport.collectionGidsValidated).toBe(true);
    expect(result.preflightReport.pricingScopeValidated).toBe(true);
  });

  it("blocks publication, inventory, theme, media, metafield, SKU, and AutoDS fields", async () => {
    const result = await createFixture().dryRun.prepare(createFixture().input);

    expect(result.blockedFields).toEqual(
      expect.arrayContaining(["product publication", "SKU", "inventory quantity", "AutoDS linkage", "theme", "media", "metafields"]),
    );
  });

  it("rejects a wrong store or product in the approved payload", async () => {
    const fixture = createFixture();
    const wrong = {
      ...fixture.input,
      approvedUpdate: { ...fixture.input.approvedUpdate, shopDomain: "wrong.myshopify.com" as const },
    };

    await expect(fixture.dryRun.prepare(wrong)).rejects.toMatchObject({ code: "PREFLIGHT_MISMATCH" });
  });

  it("rejects non-DRAFT source products", async () => {
    const fixture = createFixture({ snapshot: createSnapshot({ status: "ACTIVE" }) });
    await expect(fixture.dryRun.prepare(fixture.input)).rejects.toMatchObject({ code: "PREFLIGHT_MISMATCH" });
  });

  it("rejects invalid token lifetimes", async () => {
    const fixture = createFixture();
    await expect(
      fixture.dryRun.prepare({ ...fixture.input, tokenTtlSeconds: 30 }),
    ).rejects.toMatchObject({ code: "INVALID_EXECUTION_REQUEST" });
    await expect(
      fixture.dryRun.prepare({ ...fixture.input, tokenTtlSeconds: 901 }),
    ).rejects.toMatchObject({ code: "INVALID_EXECUTION_REQUEST" });
  });

  it("rejects invalid price scope before reading Shopify", async () => {
    const fixture = createFixture();
    const input = {
      ...fixture.input,
      approvedUpdate: {
        ...fixture.input.approvedUpdate,
        pricing: { price: "299.00", compareAtPrice: "199.00" },
      },
    };

    await expect(fixture.dryRun.prepare(input)).rejects.toMatchObject({ code: "INVALID_PROPOSAL" });
    expect(fixture.reader.readProductById).not.toHaveBeenCalled();
  });

  it("rejects unsupported dry-run input fields", async () => {
    const fixture = createFixture();
    const input = { ...fixture.input, publish: false } as ControlledExecutionDryRunInput;
    await expect(fixture.dryRun.prepare(input)).rejects.toMatchObject({ code: "EXTRA_EXECUTION_INPUT" });
  });

  it("fails safely when the exact Shopify product does not exist", async () => {
    const fixture = createFixture({ snapshot: null });
    await expect(fixture.dryRun.prepare(fixture.input)).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });
});

interface FixtureOptions {
  readonly snapshot?: ShopifyDraftPreparationProductSnapshot | null;
}

const createFixture = (options: FixtureOptions = {}) => {
  const snapshot = "snapshot" in options ? options.snapshot ?? null : createSnapshot();
  const reader: ShopifyDraftPreparationReadRepository = {
    readProductById: vi.fn(() => Promise.resolve(snapshot)),
    readProductsByHandle: vi.fn(() => Promise.resolve([])),
  };
  const input: ControlledExecutionDryRunInput = {
    executionMode: "dry-run-controlled-safe-update",
    storeDomain: STORE,
    productId: PRODUCT_ID,
    approvedUpdate: createApprovedUpdate(),
    approvedTags: ["Hair Wellness", "Scalp Care"],
    tagPolicy: "merge",
    brandContext: {
      brandName: "Lumora Beauty",
      brandVoice: "premium",
      targetMarkets: ["MY"],
      sellingCurrency: "MYR",
      preferredCollections: [COLLECTION_ID],
      templateSuffix: "velvetglow",
    },
    tokenTtlSeconds: 300,
  };

  return {
    input,
    reader,
    dryRun: new ControlledExecutionDryRun({ shopifyReader: reader, now: () => NOW }),
  };
};

const createApprovedUpdate = (): SafeShopifyProductUpdateCommand => ({
  shopDomain: STORE,
  locator: { kind: "id", productId: PRODUCT_ID },
  title: "Lumora™ Revive Red Light Scalp Massager",
  descriptionHtml: "<section><p>Approved product description.</p></section>",
  vendor: "Lumora Beauty",
  productType: "Hair Care Device",
  tagsToAdd: ["Lumora Beauty", "Hair Wellness"],
  seo: {
    title: "Lumora™ Revive Red Light Scalp Massager | Hair Wellness",
    description: "Approved SEO description.",
  },
  pricing: { price: "199.00", compareAtPrice: "299.00" },
  collectionIdsToJoin: [COLLECTION_ID],
  templateSuffix: "velvetglow",
});

const createSnapshot = (
  override: Partial<ShopifyDraftPreparationProductSnapshot> = {},
): ShopifyDraftPreparationProductSnapshot => ({
  id: PRODUCT_ID,
  title: "Lumora™ Revive Red Light Scalp Massager",
  handle: "lumora-revive-red-light-scalp-massager",
  descriptionHtml: "<p>Current description.</p>",
  vendor: "Lumora Beauty",
  productType: "Hair Care Device",
  status: "DRAFT",
  tags: ["Lumora Beauty", "Hair Wellness"],
  templateSuffix: "velvetglow",
  seoTitle: "Current SEO title",
  seoDescription: "Current SEO description",
  collections: [{ id: COLLECTION_ID, title: "Hair Wellness" }],
  media: [],
  options: [{ name: "Color", values: ["Red"] }],
  variants: [
    {
      id: "gid://shopify/ProductVariant/45602785394735",
      title: "Red",
      price: 199,
      compareAtPrice: 299,
      sku: "AUTO-RED-001",
      inventoryItemId: "gid://shopify/InventoryItem/1",
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
