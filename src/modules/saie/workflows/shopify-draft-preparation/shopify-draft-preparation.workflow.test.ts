import { describe, expect, it, vi } from "vitest";
import type {
  ProductPreparationInput,
  ProductPreparationProposal,
} from "../product-preparation/index.js";
import {
  AmbiguousShopifyProductError,
  IncompleteShopifyProductSnapshotError,
  InvalidProductLocatorError,
  InvalidShopDomainError,
  ProductPreparationProposalFailureError,
  ShopifyProductNotFoundError,
  TruncatedShopifyProductDataError,
  UnsupportedShopifyDraftPreparationModeError,
  type ShopifyDraftPreparationInput,
  type ShopifyDraftPreparationProductSnapshot,
  type ShopifyDraftPreparationReadRepository,
  type ShopifyDraftPreparationWorkflowDependencies,
} from "./shopify-draft-preparation.types.js";
import { ShopifyDraftPreparationWorkflow } from "./shopify-draft-preparation.workflow.js";

const FIXED_DATE = new Date("2026-07-15T00:00:00.000Z");
const WORKFLOW_ID = "saie-shopify-draft-preparation-test";

describe("ShopifyDraftPreparationWorkflow", () => {
  it("prepares a product by exact Shopify product ID", async () => {
    const dependencies = createDependencies();
    const result = await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(dependencies.shopifyReader.readProductById).toHaveBeenCalledWith(
      "mk9096-8w.myshopify.com",
      "gid://shopify/Product/8351602737199",
    );
    expect(result.shopifyProductIdentity.productId).toBe("gid://shopify/Product/8351602737199");
  });

  it("prepares a product by exact handle", async () => {
    const dependencies = createDependencies();
    const input = createInput({
      productLocator: {
        kind: "handle",
        handle: "lumora-revive-red-light-scalp-massager",
      },
    });

    const result = await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(
      input,
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(dependencies.shopifyReader.readProductsByHandle).toHaveBeenCalledWith(
      "mk9096-8w.myshopify.com",
      "lumora-revive-red-light-scalp-massager",
    );
    expect(result.shopifyProductIdentity.handle).toBe("lumora-revive-red-light-scalp-massager");
  });

  it("fails safely when product is not found", async () => {
    const dependencies = createDependencies({ productById: null });

    await expect(
      new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(createInput(), FIXED_DATE, WORKFLOW_ID),
    ).rejects.toThrow(ShopifyProductNotFoundError);
  });

  it("fails safely on ambiguous handle lookup", async () => {
    const snapshot = createSnapshot();
    const dependencies = createDependencies({ productsByHandle: [snapshot, snapshot] });

    await expect(
      new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(
        createInput({ productLocator: { kind: "handle", handle: snapshot.handle } }),
        FIXED_DATE,
        WORKFLOW_ID,
      ),
    ).rejects.toThrow(AmbiguousShopifyProductError);
  });

  it("fails safely on truncated product data", async () => {
    const dependencies = createDependencies({ productById: createSnapshot({ productDataTruncated: true }) });

    await expect(
      new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(createInput(), FIXED_DATE, WORKFLOW_ID),
    ).rejects.toThrow(TruncatedShopifyProductDataError);
  });

  it("preserves variant IDs and SKUs in the snapshot", async () => {
    const result = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(result.currentShopifyStateSummary.variantIds).toEqual(["gid://shopify/ProductVariant/1"]);
    expect(result.currentShopifyStateSummary.variantSkus).toEqual(["AUTO-RED-001"]);
  });

  it("preserves inventory item IDs and location quantities read-only", async () => {
    const dependencies = createDependencies();

    await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(createInput(), FIXED_DATE, WORKFLOW_ID);

    const preparationInput = getPreparationInput(dependencies);
    expect(preparationInput.currentShopifyState?.inventoryItemIds).toEqual(["gid://shopify/InventoryItem/1"]);
    expect(preparationInput.currentShopifyState?.inventoryLocations).toEqual([
      {
        locationId: "gid://shopify/Location/1",
        locationName: "Shop",
        quantities: { "gid://shopify/InventoryItem/1": 10 },
      },
    ]);
  });

  it("includes store currency", async () => {
    const result = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(result.currentShopifyStateSummary.storeCurrency).toBe("MYR");
  });

  it("does not hardcode brand context", async () => {
    const dependencies = createDependencies();
    const input = createInput({
      brandContext: {
        brandName: "Aster Brand",
        brandVoice: "calm",
        targetMarkets: ["US"],
        sellingCurrency: "USD",
        preferredCollections: ["Wellness Tools"],
        templateSuffix: "aster-template",
      },
      supplierCost: {
        productCost: 30,
        shippingCost: 5,
        transactionCost: 2,
        advertisingCostEstimate: 8,
        currency: "USD",
      },
    });

    await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(input, FIXED_DATE, WORKFLOW_ID);

    const preparationInput = getPreparationInput(dependencies);
    expect(preparationInput.brandContext.brandName).toBe("Aster Brand");
    expect(preparationInput.brandContext.templateSuffix).toBe("aster-template");
  });

  it("skips pricing safely when supplier cost is unavailable", async () => {
    const dependencies = createDependencies();

    const result = await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(
      createInputWithoutSupplierCost(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    const preparationInput = getPreparationInput(dependencies);
    expect(preparationInput.requestedCapabilities.recommendPricing).toBe(false);
    expect(preparationInput.requestedCapabilities.mapForShopify).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "missing-supplier-cost",
      }),
    );
  });

  it("skips ProductAnalyzer without explicit compatible context", async () => {
    const dependencies = createDependencies();

    await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(
      createInputWithoutAnalysisContext(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(getPreparationInput(dependencies).optionalAnalysisContext).toBeUndefined();
  });

  it("reuses the existing Product Preparation Proposal Workflow", async () => {
    const dependencies = createDependencies();

    await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(createInput(), FIXED_DATE, WORKFLOW_ID);

    expect(dependencies.productPreparationWorkflow.prepareProposal).toHaveBeenCalledTimes(1);
  });

  it("never calls ShopifyProductUpdateService", async () => {
    const dependencies = createDependencies();

    await new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(createInput(), FIXED_DATE, WORKFLOW_ID);

    expect(JSON.stringify(dependencies)).not.toContain("ShopifyProductUpdateService");
  });

  it("does not invoke mutation operations", async () => {
    const result = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(result.executionSafetyReport.shopifyMutationExecuted).toBe(false);
    expect(result.mutationExecuted).toBe(false);
  });

  it("does not invoke publication operations", async () => {
    const result = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(result.executionSafetyReport.productPublicationExecuted).toBe(false);
    expect(result.publicationExecuted).toBe(false);
  });

  it("always requires human approval", async () => {
    const result = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(result.approvalStatus).toBe("required");
    expect(result.executionSafetyReport.humanApprovalRequired).toBe(true);
  });

  it("keeps future target status as DRAFT", async () => {
    const result = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(result.preparationProposal.safeUpdateProposal?.targetStatus).toBe("DRAFT");
  });

  it("does not mutate input objects", async () => {
    const input = createInput();
    const before = JSON.stringify(input);

    await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(input, FIXED_DATE, WORKFLOW_ID);

    expect(JSON.stringify(input)).toBe(before);
  });

  it("produces deterministic output for a fixed workflow ID and generatedAt", async () => {
    const first = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );
    const second = await new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(second).toEqual(first);
  });

  it("rejects unsupported execution mode", async () => {
    const input = {
      ...createInput(),
      executionMode: "mutate",
    } as unknown as ShopifyDraftPreparationInput;

    await expect(
      new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(input, FIXED_DATE, WORKFLOW_ID),
    ).rejects.toThrow(UnsupportedShopifyDraftPreparationModeError);
  });

  it("rejects invalid shop domains and invalid locators", async () => {
    await expect(
      new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
        { ...createInput(), shopDomain: "example.com" as `${string}.myshopify.com` },
        FIXED_DATE,
        WORKFLOW_ID,
      ),
    ).rejects.toThrow(InvalidShopDomainError);

    await expect(
      new ShopifyDraftPreparationWorkflow(createDependencies()).prepareDraft(
        {
          ...createInput(),
          productLocator: { kind: "handle", handle: "Bad Handle" },
        },
        FIXED_DATE,
        WORKFLOW_ID,
      ),
    ).rejects.toThrow(InvalidProductLocatorError);
  });

  it("fails safely when proposal workflow fails", async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.productPreparationWorkflow.prepareProposal).mockImplementationOnce(() => {
      throw new Error("proposal dependency failed");
    });

    await expect(
      new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(createInput(), FIXED_DATE, WORKFLOW_ID),
    ).rejects.toThrow(ProductPreparationProposalFailureError);
  });

  it("fails safely on incomplete identity data", async () => {
    const dependencies = createDependencies({
      productById: createSnapshot({
        variants: [
          {
            ...createSnapshot().variants[0]!,
            inventoryItemId: "",
          },
        ],
      }),
    });

    await expect(
      new ShopifyDraftPreparationWorkflow(dependencies).prepareDraft(createInput(), FIXED_DATE, WORKFLOW_ID),
    ).rejects.toThrow(IncompleteShopifyProductSnapshotError);
  });
});

interface DependencyOptions {
  readonly productById?: ShopifyDraftPreparationProductSnapshot | null;
  readonly productsByHandle?: readonly ShopifyDraftPreparationProductSnapshot[];
}

const createDependencies = (options: DependencyOptions = {}): ShopifyDraftPreparationWorkflowDependencies => {
  const snapshot = createSnapshot();
  const proposal = createProposal();
  const reader: ShopifyDraftPreparationReadRepository = {
    readProductById: vi.fn(() => Promise.resolve("productById" in options ? options.productById ?? null : snapshot)),
    readProductsByHandle: vi.fn(() => Promise.resolve(options.productsByHandle ?? [snapshot])),
  };

  return {
    shopifyReader: reader,
    productPreparationWorkflow: {
      prepareProposal: vi.fn((): ProductPreparationProposal => proposal),
    },
  };
};

const getPreparationInput = (dependencies: ShopifyDraftPreparationWorkflowDependencies): ProductPreparationInput => {
  const calls = vi.mocked(dependencies.productPreparationWorkflow.prepareProposal).mock.calls;
  const firstCall = calls[0];

  if (firstCall === undefined) {
    throw new Error("Product preparation workflow was not called.");
  }

  return firstCall[0];
};

const createInput = (override: Partial<ShopifyDraftPreparationInput> = {}): ShopifyDraftPreparationInput => ({
  executionMode: "shopify-draft-preparation",
  shopDomain: "mk9096-8w.myshopify.com",
  productLocator: {
    kind: "product-id",
    productId: "gid://shopify/Product/8351602737199",
  },
  brandContext: {
    brandName: "Lumora Beauty",
    brandVoice: "premium",
    targetMarkets: ["MY"],
    sellingCurrency: "MYR",
    preferredCollections: ["Hair Wellness"],
    templateSuffix: "velvetglow",
  },
  requestedCapabilities: {
    normalize: true,
    analyze: true,
    assessRisk: true,
    generateBranding: true,
    generateCopy: true,
    recommendPricing: true,
    mapForShopify: true,
    prepareSafeUpdateProposal: true,
  },
  optionalAnalysisContext: {
    score: {
      demand: 70,
      competition: 50,
      profitability: 75,
      trend: 60,
      supplierReliability: 80,
      shipping: 70,
      marketingPotential: 75,
      brandability: 82,
      overall: 75,
    },
    riskAssessment: {
      level: "low",
      score: 18,
      reasons: ["Fixture risk context."],
      intellectualPropertyRisk: 0,
      restrictedProductRisk: 0,
      supplierRisk: 18,
      shippingRisk: 20,
      refundRisk: 14,
    },
  },
  supplierCost: {
    productCost: 72,
    shippingCost: 12,
    transactionCost: 4,
    advertisingCostEstimate: 20,
    currency: "MYR",
  },
  ...override,
});

const createInputWithoutSupplierCost = (): ShopifyDraftPreparationInput => {
  const input = createInput();
  return {
    executionMode: input.executionMode,
    shopDomain: input.shopDomain,
    productLocator: input.productLocator,
    brandContext: input.brandContext,
    requestedCapabilities: input.requestedCapabilities,
    ...(input.optionalAnalysisContext === undefined ? {} : { optionalAnalysisContext: input.optionalAnalysisContext }),
  };
};

const createInputWithoutAnalysisContext = (): ShopifyDraftPreparationInput => {
  const input = createInput();
  return {
    executionMode: input.executionMode,
    shopDomain: input.shopDomain,
    productLocator: input.productLocator,
    brandContext: input.brandContext,
    requestedCapabilities: input.requestedCapabilities,
    ...(input.supplierCost === undefined ? {} : { supplierCost: input.supplierCost }),
  };
};

const createSnapshot = (
  override: Partial<ShopifyDraftPreparationProductSnapshot> = {},
): ShopifyDraftPreparationProductSnapshot => ({
  id: "gid://shopify/Product/8351602737199",
  title: "Lumora Revive Red Light Scalp Massager",
  handle: "lumora-revive-red-light-scalp-massager",
  descriptionHtml: "<p>Rechargeable scalp-care device for daily routines.</p>",
  vendor: "Lumora Beauty",
  productType: "Hair Care Device",
  status: "DRAFT",
  tags: ["Lumora Beauty", "Hair Wellness"],
  templateSuffix: "velvetglow",
  seoTitle: "Lumora Revive | Hair Wellness",
  seoDescription: "A scalp-care device for daily routines.",
  collections: [{ id: "gid://shopify/Collection/1", title: "Hair Wellness" }],
  media: [
    {
      id: "gid://shopify/MediaImage/1",
      url: "https://cdn.example/lumora-scalp-massager.jpg",
      altText: "Lumora scalp massager",
    },
  ],
  options: [{ name: "Color", values: ["Red"] }],
  variants: [
    {
      id: "gid://shopify/ProductVariant/1",
      title: "Red",
      price: 199,
      compareAtPrice: 299,
      sku: "AUTO-RED-001",
      inventoryItemId: "gid://shopify/InventoryItem/1",
      inventoryTracked: true,
      inventoryPolicy: "DENY",
      inventoryQuantities: [
        {
          locationId: "gid://shopify/Location/1",
          locationName: "Shop",
          quantity: 10,
        },
      ],
      optionValues: { Color: "Red" },
    },
  ],
  storeCurrency: "MYR",
  onlineStoreUrl: "https://sirehshope.myshopify.com/products/lumora-revive-red-light-scalp-massager",
  productDataTruncated: false,
  variantDataTruncated: false,
  inventoryDataIncomplete: false,
  ...override,
});

const createProposal = (): ProductPreparationProposal => ({
  workflowId: "proposal-id",
  executionMode: "proposal-only",
  productReference: {
    sourceId: "gid://shopify/Product/8351602737199",
    sourceUrl: "shopify://mk9096-8w.myshopify.com/products/lumora-revive-red-light-scalp-massager",
    title: "Lumora Revive Red Light Scalp Massager",
  },
  completedSteps: [{ id: "RequireHumanApproval", order: 10, status: "completed" }],
  skippedSteps: [],
  warnings: [],
  safeUpdateProposal: {
    targetStatus: "DRAFT",
    title: "Lumora Revive Red Light Scalp Massager",
    descriptionHtml: "<p>Proposal description.</p>",
    vendor: "Lumora Beauty",
    productType: "Hair Care Device",
    tagsToAdd: ["Hair Wellness"],
    approvedTags: ["Hair Wellness"],
    tagPolicy: "merge",
    seoTitle: "Lumora Revive | Hair Wellness",
    seoDescription: "Proposal SEO.",
    pricing: {
      currency: "MYR",
      price: 199,
      compareAtPrice: 299,
    },
    collectionReferences: ["Hair Wellness"],
    templateSuffix: "velvetglow",
    excludedMutations: ["variant recreation", "SKU mutation", "inventory item mutation", "publication mutation"],
  },
  preservationRequirements: [],
  approvalStatus: "required",
  mutationExecuted: false,
  publicationExecuted: false,
  readyForHumanReview: true,
  generatedAt: FIXED_DATE.toISOString(),
});
