import {
  ProductPreparationWorkflow,
  type ProductPreparationInput,
  type ProductPreparationShopifyState,
} from "../product-preparation/index.js";
import { createShopifyDraftPreparationSafetyReport } from "./shopify-draft-preparation.result.js";
import {
  ShopifyProductSnapshotMapper,
} from "./shopify-product-snapshot.mapper.js";
import { ShopifyPreservationSnapshotBuilder } from "./shopify-preservation-snapshot.builder.js";
import type {
  ShopifyDraftPreparationInput,
  ShopifyDraftPreparationProductSnapshot,
  ShopifyDraftPreparationResult,
  ShopifyDraftPreparationWarning,
  ShopifyDraftPreparationWorkflowDependencies,
} from "./shopify-draft-preparation.types.js";
import {
  ProductPreparationProposalFailureError,
  ShopifyProductNotFoundError,
} from "./shopify-draft-preparation.types.js";
import {
  resolveSingleShopifyProductSnapshot,
  validateShopifyDraftPreparationInput,
  validateShopifyProductSnapshot,
} from "./shopify-draft-preparation.validation.js";

export class ShopifyDraftPreparationWorkflow {
  private readonly mapper = new ShopifyProductSnapshotMapper();
  private readonly preservationBuilder = new ShopifyPreservationSnapshotBuilder();

  public constructor(private readonly dependencies: ShopifyDraftPreparationWorkflowDependencies) {}

  public async prepareDraft(
    input: ShopifyDraftPreparationInput,
    generatedAt: Date = new Date(),
    workflowId = `saie-shopify-draft-preparation-${generatedAt.toISOString()}`,
  ): Promise<ShopifyDraftPreparationResult> {
    validateShopifyDraftPreparationInput(input);

    const snapshot = await this.readSnapshot(input);
    validateShopifyProductSnapshot(snapshot, input);

    const mapping = this.mapper.map(snapshot, input);
    const preservationSnapshot = this.preservationBuilder.build(snapshot);
    const warnings: ShopifyDraftPreparationWarning[] = [...mapping.warnings];
    const preparationInput = this.toProductPreparationInput(input, mapping, preservationSnapshot);
    const proposal = this.prepareProposal(preparationInput, generatedAt, `${workflowId}:proposal`);

    return {
      workflowId,
      executionMode: "shopify-draft-preparation",
      shopDomain: input.shopDomain,
      productLocator: { ...input.productLocator },
      shopifyProductIdentity: {
        productId: snapshot.id,
        handle: snapshot.handle,
      },
      currentShopifyStateSummary: {
        productId: snapshot.id,
        handle: snapshot.handle,
        status: snapshot.status,
        title: snapshot.title,
        vendor: snapshot.vendor,
        productType: snapshot.productType,
        ...(snapshot.templateSuffix === undefined ? {} : { templateSuffix: snapshot.templateSuffix }),
        storeCurrency: snapshot.storeCurrency,
        collectionIds: snapshot.collections.map((collection) => collection.id),
        variantIds: snapshot.variants.map((variant) => variant.id),
        variantSkus: snapshot.variants.map((variant) => variant.sku),
        inventoryItemIds: snapshot.variants.map((variant) => variant.inventoryItemId),
      },
      sourceProductSnapshot: mapping.sourceProduct,
      preparationProposal: proposal,
      executionSafetyReport: createShopifyDraftPreparationSafetyReport(),
      warnings,
      approvalStatus: "required",
      mutationExecuted: false,
      publicationExecuted: false,
      readyForHumanReview: proposal.readyForHumanReview,
      generatedAt: generatedAt.toISOString(),
    };
  }

  private async readSnapshot(input: ShopifyDraftPreparationInput): Promise<ShopifyDraftPreparationProductSnapshot> {
    if (input.productLocator.kind === "product-id") {
      const snapshot = await this.dependencies.shopifyReader.readProductById(
        input.shopDomain,
        input.productLocator.productId,
      );

      if (snapshot === null) {
        throw new ShopifyProductNotFoundError();
      }

      return snapshot;
    }

    const snapshots = await this.dependencies.shopifyReader.readProductsByHandle(
      input.shopDomain,
      input.productLocator.handle,
    );

    return resolveSingleShopifyProductSnapshot(snapshots);
  }

  private toProductPreparationInput(
    input: ShopifyDraftPreparationInput,
    mapping: ReturnType<ShopifyProductSnapshotMapper["map"]>,
    preservationSnapshot: ProductPreparationShopifyState,
  ): ProductPreparationInput {
    const pricingSafelyAvailable = mapping.pricingSafelyAvailable && input.requestedCapabilities.recommendPricing;
    const analysisContext =
      input.requestedCapabilities.analyze && input.optionalAnalysisContext !== undefined
        ? { optionalAnalysisContext: input.optionalAnalysisContext }
        : {};

    return {
      executionMode: "proposal-only",
      sourceProduct: mapping.sourceProduct,
      brandContext: {
        ...input.brandContext,
        targetMarkets: [...input.brandContext.targetMarkets],
        preferredCollections: [...input.brandContext.preferredCollections],
      },
      requestedCapabilities: {
        normalize: input.requestedCapabilities.normalize,
        assessRisk: input.requestedCapabilities.assessRisk,
        generateBranding: input.requestedCapabilities.generateBranding,
        generateCopy: input.requestedCapabilities.generateCopy,
        recommendPricing: pricingSafelyAvailable,
        mapForShopify: pricingSafelyAvailable && input.requestedCapabilities.mapForShopify,
        prepareSafeUpdateProposal: input.requestedCapabilities.prepareSafeUpdateProposal,
      },
      ...analysisContext,
      currentShopifyState: preservationSnapshot,
    };
  }

  private prepareProposal(
    input: ProductPreparationInput,
    generatedAt: Date,
    workflowId: string,
  ) {
    try {
      return this.dependencies.productPreparationWorkflow.prepareProposal(input, generatedAt, workflowId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown proposal failure.";
      throw new ProductPreparationProposalFailureError(message);
    }
  }
}

export const createShopifyDraftPreparationWorkflow = (
  shopifyReader: ShopifyDraftPreparationWorkflowDependencies["shopifyReader"],
): ShopifyDraftPreparationWorkflow =>
  new ShopifyDraftPreparationWorkflow({
    shopifyReader,
    productPreparationWorkflow: new ProductPreparationWorkflow(),
  });
