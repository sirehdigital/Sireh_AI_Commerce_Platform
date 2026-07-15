import { describe, expect, it, vi } from "vitest";
import type { ShopifyShopDomain } from "../../../integrations/shopify/shopify.types.js";
import type { ShopifyDraftPreparationResult } from "../workflows/index.js";
import { parseCommerceConsoleArguments, toShopifyDraftPreparationInput } from "./commerce-console.arguments.js";
import { CommerceConsoleArgumentError } from "./commerce-console.errors.js";
import { presentCommerceConsoleResult } from "./commerce-console.presenter.js";
import { runCommerceConsole } from "./commerce-console.js";
import type { CommerceConsoleIo, CommerceConsoleWorkflowRunner } from "./commerce-console.types.js";

describe("Commerce Console", () => {
  it("parses exact product ID invocation", () => {
    const args = parseCommerceConsoleArguments([
      "--shop",
      "mk9096-8w.myshopify.com",
      "--product-id",
      "gid://shopify/Product/8351602737199",
      "--brand-config",
      "lumora",
      "--format",
      "summary",
    ]);

    expect(args.productLocator).toEqual({
      kind: "product-id",
      productId: "gid://shopify/Product/8351602737199",
    });
    expect(args.format).toBe("summary");
  });

  it("parses exact handle invocation", () => {
    const args = parseCommerceConsoleArguments([
      "--shop",
      "mk9096-8w.myshopify.com",
      "--handle",
      "lumora-revive-red-light-scalp-massager",
    ]);

    expect(args.productLocator).toEqual({
      kind: "handle",
      handle: "lumora-revive-red-light-scalp-massager",
    });
  });

  it("rejects fuzzy or ambiguous locator input", () => {
    expect(() =>
      parseCommerceConsoleArguments([
        "--shop",
        "mk9096-8w.myshopify.com",
        "--product-id",
        "gid://shopify/Product/8351602737199",
        "--handle",
        "lumora-revive-red-light-scalp-massager",
      ]),
    ).toThrow(CommerceConsoleArgumentError);

    expect(() =>
      parseCommerceConsoleArguments([
        "--shop",
        "mk9096-8w.myshopify.com",
        "--handle",
        "Lumora Revive",
      ]),
    ).toThrow(CommerceConsoleArgumentError);
  });

  it("converts arguments into Shopify draft preparation input", () => {
    const input = toShopifyDraftPreparationInput(
      parseCommerceConsoleArguments([
        "--shop",
        "mk9096-8w.myshopify.com",
        "--product-id",
        "gid://shopify/Product/8351602737199",
        "--brand-config",
        "lumora",
      ]),
    );

    expect(input.executionMode).toBe("shopify-draft-preparation");
    expect(input.brandContext.brandName).toBe("Lumora Beauty");
    expect(input.requestedCapabilities.prepareSafeUpdateProposal).toBe(true);
    expect(input.supplierCost).toBeUndefined();
  });

  it("presents a human-readable summary", () => {
    const output = presentCommerceConsoleResult(createResult(), "summary");

    expect(output).toContain("SAIE Commerce Console");
    expect(output).toContain("Shopify mutation executed: false");
    expect(output).toContain("Human approval required: true");
    expect(output).toContain("Target status: DRAFT");
  });

  it("presents complete JSON when requested", () => {
    const output = presentCommerceConsoleResult(createResult(), "json");

    expect(JSON.parse(output) as unknown).toMatchObject({
      executionMode: "shopify-draft-preparation",
      mutationExecuted: false,
      publicationExecuted: false,
    });
  });

  it("runs the console with an injected workflow runner", async () => {
    const io = createIo();
    const runner = createRunner();
    const factory = vi.fn((shop: ShopifyShopDomain) => {
      expect(shop).toBe("mk9096-8w.myshopify.com");
      return Promise.resolve(runner);
    });

    const result = await runCommerceConsole(
      [
        "--shop",
        "mk9096-8w.myshopify.com",
        "--product-id",
        "gid://shopify/Product/8351602737199",
        "--brand-config",
        "lumora",
        "--format",
        "summary",
      ],
      io,
      factory,
    );

    expect(result.exitCode).toBe(0);
    expect(runner.prepareDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: "shopify-draft-preparation",
        productLocator: {
          kind: "product-id",
          productId: "gid://shopify/Product/8351602737199",
        },
      }),
    );
    expect(io.stdoutText()).toContain("SAIE Commerce Console");
    expect(io.stderrText()).toBe("");
  });

  it("fails safely without exposing credentials", async () => {
    const io = createIo();
    const result = await runCommerceConsole(
      ["--shop", "bad-domain", "--handle", "product"],
      io,
      () => Promise.resolve(createRunner()),
    );

    expect(result.exitCode).toBe(1);
    expect(io.stderrText()).toContain("failed safely");
    expect(io.stderrText().toLowerCase()).not.toContain("token");
  });
});

const createIo = () => {
  let stdout = "";
  let stderr = "";
  const io: CommerceConsoleIo & {
    readonly stdoutText: () => string;
    readonly stderrText: () => string;
  } = {
    stdout: {
      write: (chunk: string | Uint8Array) => {
        stdout += chunk.toString();
        return true;
      },
    },
    stderr: {
      write: (chunk: string | Uint8Array) => {
        stderr += chunk.toString();
        return true;
      },
    },
    stdoutText: () => stdout,
    stderrText: () => stderr,
  };

  return io;
};

const createRunner = (): CommerceConsoleWorkflowRunner => ({
  prepareDraft: vi.fn(() => Promise.resolve(createResult())),
});

const createResult = (): ShopifyDraftPreparationResult => ({
  workflowId: "console-test",
  executionMode: "shopify-draft-preparation",
  shopDomain: "mk9096-8w.myshopify.com",
  productLocator: {
    kind: "product-id",
    productId: "gid://shopify/Product/8351602737199",
  },
  shopifyProductIdentity: {
    productId: "gid://shopify/Product/8351602737199",
    handle: "lumora-revive-red-light-scalp-massager",
  },
  currentShopifyStateSummary: {
    productId: "gid://shopify/Product/8351602737199",
    handle: "lumora-revive-red-light-scalp-massager",
    status: "DRAFT",
    title: "Lumora Revive Red Light Scalp Massager",
    vendor: "Lumora Beauty",
    productType: "Hair Care Device",
    templateSuffix: "velvetglow",
    storeCurrency: "MYR",
    collectionIds: ["gid://shopify/Collection/1"],
    variantIds: ["gid://shopify/ProductVariant/1"],
    variantSkus: ["AUTO-RED-001"],
    inventoryItemIds: ["gid://shopify/InventoryItem/1"],
  },
  sourceProductSnapshot: {
    sourceId: "gid://shopify/Product/8351602737199",
    sourceUrl: "shopify://mk9096-8w.myshopify.com/products/lumora-revive-red-light-scalp-massager",
    title: "Lumora Revive Red Light Scalp Massager",
    description: "Fixture product.",
    brand: "Lumora Beauty",
    category: "Hair Care Device",
    productType: "Hair Care Device",
    tags: ["Hair Wellness"],
    images: [],
    options: [{ name: "Color", values: ["Red"] }],
    variants: [
      {
        id: "gid://shopify/ProductVariant/1",
        sku: "AUTO-RED-001",
        title: "Red",
        optionValues: { Color: "Red" },
        suggestedPrice: 199,
        currency: "MYR",
        available: true,
      },
    ],
    supplier: {
      source: "shopify",
      supplierProductId: "gid://shopify/Product/8351602737199",
    },
    cost: {
      productCost: 0,
      shippingCost: 0,
      transactionCost: 0,
      advertisingCostEstimate: 0,
      totalLandedCost: 0,
      currency: "MYR",
    },
    currency: "MYR",
    targetMarkets: ["MY"],
  },
  preparationProposal: {
    workflowId: "proposal",
    executionMode: "proposal-only",
    productReference: {
      sourceId: "gid://shopify/Product/8351602737199",
      sourceUrl: "shopify://mk9096-8w.myshopify.com/products/lumora-revive-red-light-scalp-massager",
      title: "Lumora Revive Red Light Scalp Massager",
    },
    completedSteps: [{ id: "RequireHumanApproval", order: 10, status: "completed" }],
    skippedSteps: [{ id: "RecommendProductPricing", reason: "capability-not-requested", notes: ["Skipped."] }],
    warnings: ["Pricing skipped because supplier cost was not supplied."],
    safeUpdateProposal: {
      targetStatus: "DRAFT",
      title: "Lumora Revive Red Light Scalp Massager",
      vendor: "Lumora Beauty",
      productType: "Hair Care Device",
      tagsToAdd: ["Hair Wellness"],
      approvedTags: ["Hair Wellness"],
      tagPolicy: "merge",
      collectionReferences: ["Hair Wellness"],
      templateSuffix: "velvetglow",
      excludedMutations: ["SKU mutation", "inventory item mutation", "publication mutation"],
    },
    preservationRequirements: [],
    approvalStatus: "required",
    mutationExecuted: false,
    publicationExecuted: false,
    readyForHumanReview: true,
    generatedAt: "2026-07-15T00:00:00.000Z",
  },
  executionSafetyReport: {
    shopifyReadExecuted: true,
    shopifyMutationExecuted: false,
    productPublicationExecuted: false,
    inventoryMutationExecuted: false,
    themeMutationExecuted: false,
    humanApprovalRequired: true,
  },
  warnings: [{ code: "missing-supplier-cost", message: "Supplier cost missing." }],
  approvalStatus: "required",
  mutationExecuted: false,
  publicationExecuted: false,
  readyForHumanReview: true,
  generatedAt: "2026-07-15T00:00:00.000Z",
});
