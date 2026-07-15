import type { SafeShopifyProductUpdateCommand } from "../../../integrations/shopify/shopify-product-update.types.js";
import { PRODUCT_PREPARATION_EXCLUDED_MUTATIONS } from "../workflows/product-preparation/product-preparation.steps.js";
import {
  createPreservationRequirements,
  type ProductPreparationProposal,
} from "../workflows/product-preparation/index.js";
import {
  ShopifyPreservationSnapshotBuilder,
  type ShopifyDraftPreparationProductSnapshot,
  type ShopifyDraftPreparationReadRepository,
} from "../workflows/shopify-draft-preparation/index.js";
import {
  createReviewApprovalToken,
} from "./approval-token.js";
import { CONTROLLED_EXECUTION_SKIPPED_FIELDS } from "./execution-audit.js";
import { ControlledExecutionError } from "./execution-errors.js";
import type { ControlledSafeUpdateExecutionRequest } from "./execution-request.js";
import type {
  ControlledExecutionDryRunInput,
  ControlledExecutionDryRunResult,
} from "./execution-dry-run.types.js";
import {
  validateControlledExecutionRequest,
  validateExecutionPreflight,
  validateReviewApprovalToken,
} from "./execution-validation.js";
import { HtmlVerificationNormalizer } from "./verification/index.js";
import { TagReconciliationService, type TagReconciliationPreview } from "./tag-reconciliation/index.js";

const MIN_TOKEN_TTL_SECONDS = 60;
const MAX_TOKEN_TTL_SECONDS = 900;
const DRY_RUN_INPUT_KEYS = [
  "approvedUpdate",
  "approvedTags",
  "brandContext",
  "executionMode",
  "productId",
  "storeDomain",
  "tagPolicy",
  "tokenTtlSeconds",
] as const;

export interface ControlledExecutionDryRunDependencies {
  readonly shopifyReader: ShopifyDraftPreparationReadRepository;
  readonly now?: () => Date;
}

export class ControlledExecutionDryRun {
  private readonly htmlNormalizer = new HtmlVerificationNormalizer();
  private readonly tagReconciliation = new TagReconciliationService();

  public constructor(private readonly dependencies: ControlledExecutionDryRunDependencies) {}

  public async prepare(
    input: ControlledExecutionDryRunInput,
  ): Promise<ControlledExecutionDryRunResult> {
    this.validateInput(input);
    const generatedAt = (this.dependencies.now ?? (() => new Date()))();
    const expiresAt = new Date(generatedAt.getTime() + input.tokenTtlSeconds * 1000);
    const snapshot = await this.dependencies.shopifyReader.readProductById(
      input.storeDomain,
      input.productId,
    );

    if (snapshot === null) {
      throw new ControlledExecutionError("PRODUCT_NOT_FOUND", "Exact Shopify product ID was not found.");
    }

    const tagReconciliation = this.tagReconciliation.preview({
      policy: input.tagPolicy,
      existingTags: snapshot.tags,
      approvedTags: input.approvedTags,
    });
    const htmlVerification = this.htmlNormalizer.compare(
      input.approvedUpdate.descriptionHtml,
      snapshot.descriptionHtml,
    );
    if (htmlVerification.differenceReason?.startsWith("Fail-closed") === true) {
      throw new ControlledExecutionError(
        "INVALID_PROPOSAL",
        htmlVerification.differenceReason,
      );
    }
    const warnings = this.createMediaWarnings(snapshot);
    const proposal = this.createApprovedProposal(
      input,
      snapshot,
      generatedAt,
      tagReconciliation,
      warnings.map((warning) => warning.message),
    );
    const approvalToken = createReviewApprovalToken({
      proposal,
      storeDomain: input.storeDomain,
      productId: input.productId,
      issuedAt: generatedAt,
      expiresAt,
    });
    const executionRequest: ControlledSafeUpdateExecutionRequest = {
      executionMode: "controlled-safe-update",
      approvedProposal: proposal,
      approvalToken,
      productId: input.productId,
      storeDomain: input.storeDomain,
      brandContext: {
        ...input.brandContext,
        targetMarkets: [...input.brandContext.targetMarkets],
        preferredCollections: [...input.brandContext.preferredCollections],
      },
    };

    validateControlledExecutionRequest(executionRequest);
    const proposalHash = validateReviewApprovalToken(executionRequest, generatedAt);
    validateExecutionPreflight(executionRequest, snapshot, proposalHash, {
      allowUnsupportedTagPolicyPreview: true,
    });

    return {
      executionMode: "dry-run-controlled-safe-update",
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      snapshot,
      approvedProposal: proposal,
      proposalHash,
      approvalToken,
      approvalTokenSummary: {
        workflowId: approvalToken.workflowId,
        proposalHash: approvalToken.proposalHash,
        approvedBy: approvalToken.approvedBy,
        approvedAt: approvalToken.approvedAt,
        expiresAt: approvalToken.expiresAt,
        approvalScope: {
          ...approvalToken.approvalScope,
          approvedFields: [...approvalToken.approvalScope.approvedFields],
        },
        reviewOnly: true,
      },
      mutationReadyExecutionRequest: executionRequest,
      htmlVerification,
      tagReconciliation,
      warnings,
      preflightReport: {
        workflowMatched: true,
        storeMatched: true,
        productIdMatched: true,
        handleMatched: true,
        statusIsDraft: true,
        approvedFieldScopeMatched: true,
        variantIdsMatched: true,
        skusMatched: true,
        inventoryItemIdsMatched: true,
        inventoryTrackingMatched: true,
        inventoryPoliciesMatched: true,
        locationsMatched: true,
        collectionGidsValidated: true,
        pricingScopeValidated: true,
        templateValidated: true,
        targetStatusIsDraft: true,
        semanticHtmlVerificationReady: true,
        tagPolicyValidated: true,
        executionBlockedByTagPolicy: !tagReconciliation.executionSupportedByMergeOnlyService,
        passed: true,
      },
      preservationRequirements: proposal.preservationRequirements.map((requirement) => ({
        ...requirement,
      })),
      blockedFields: [...CONTROLLED_EXECUTION_SKIPPED_FIELDS],
      safetyReport: {
        shopifyReadExecuted: true,
        shopifyProductUpdateServiceCalled: false,
        shopifyMutationExecuted: false,
        publicationExecuted: false,
        inventoryMutation: false,
        themeMutation: false,
        mediaMutation: false,
        metafieldMutation: false,
        humanApprovalRequired: true,
        executionBlocked: !tagReconciliation.executionSupportedByMergeOnlyService,
        reviewTokenExecutable: false,
        secretsRedacted: true,
      },
    };
  }

  private createApprovedProposal(
    input: ControlledExecutionDryRunInput,
    snapshot: ShopifyDraftPreparationProductSnapshot,
    generatedAt: Date,
    tagReconciliation: TagReconciliationPreview,
    warnings: readonly string[],
  ): ProductPreparationProposal {
    const command = input.approvedUpdate;
    const state = new ShopifyPreservationSnapshotBuilder().build(snapshot);

    return {
      workflowId: `saie-controlled-dry-run-${input.productId.split("/").at(-1) ?? "product"}-${generatedAt.toISOString()}`,
      executionMode: "proposal-only",
      productReference: {
        sourceId: snapshot.id,
        sourceUrl: `shopify://${input.storeDomain}/products/${snapshot.handle}`,
        title: snapshot.title,
      },
      completedSteps: [
        { id: "PrepareSafeUpdateProposal", order: 9, status: "completed" },
        { id: "RequireHumanApproval", order: 10, status: "completed" },
      ],
      skippedSteps: [],
      warnings: ["Review-only dry run. No Shopify mutation was executed.", ...warnings],
      safeUpdateProposal: {
        targetStatus: "DRAFT",
        title: command.title,
        descriptionHtml: command.descriptionHtml,
        vendor: command.vendor,
        productType: command.productType,
        tagsToAdd: [...tagReconciliation.tagsToAdd],
        approvedTags: [...tagReconciliation.approvedTags],
        tagPolicy: tagReconciliation.policy,
        seoTitle: command.seo.title,
        seoDescription: command.seo.description,
        pricing: {
          currency: snapshot.storeCurrency,
          price: Number(command.pricing.price),
          compareAtPrice: Number(command.pricing.compareAtPrice),
        },
        collectionReferences: [...command.collectionIdsToJoin],
        templateSuffix: command.templateSuffix,
        excludedMutations: [...PRODUCT_PREPARATION_EXCLUDED_MUTATIONS],
      },
      preservationRequirements: createPreservationRequirements({
        executionMode: "proposal-only",
        sourceProduct: {
          sourceId: snapshot.id,
          sourceUrl: `shopify://${input.storeDomain}/products/${snapshot.handle}`,
          title: snapshot.title,
          description: snapshot.descriptionHtml,
          brand: snapshot.vendor,
          category: snapshot.productType,
          productType: snapshot.productType,
          tags: [...snapshot.tags],
          images: [],
          options: [],
          variants: [],
          supplier: {
            source: "shopify",
            supplierName: "Shopify preservation snapshot",
            supplierProductId: snapshot.id,
            supplierProductUrl: `shopify://${input.storeDomain}/products/${snapshot.handle}`,
          },
          cost: {
            productCost: 0,
            shippingCost: 0,
            transactionCost: 0,
            advertisingCostEstimate: 0,
            totalLandedCost: 0,
            currency: snapshot.storeCurrency,
          },
          currency: snapshot.storeCurrency,
          targetMarkets: [...input.brandContext.targetMarkets],
        },
        brandContext: input.brandContext,
        requestedCapabilities: {
          normalize: false,
          assessRisk: false,
          generateBranding: false,
          generateCopy: false,
          recommendPricing: false,
          mapForShopify: false,
          prepareSafeUpdateProposal: true,
        },
        currentShopifyState: state,
      }),
      approvalStatus: "required",
      mutationExecuted: false,
      publicationExecuted: false,
      readyForHumanReview: true,
      generatedAt: generatedAt.toISOString(),
    };
  }

  private createMediaWarnings(
    snapshot: ShopifyDraftPreparationProductSnapshot,
  ): ControlledExecutionDryRunResult["warnings"] {
    return snapshot.media.flatMap((media) => {
      const altText = media.altText?.trim();
      if (altText?.toLowerCase().startsWith("umora") !== true) {
        return [];
      }
      return [{
        code: "MEDIA_ALT_TEXT_OBSERVATION" as const,
        severity: "non-blocking" as const,
        message:
          "Media alt text begins with 'umora'; media mutation is excluded and requires a separate approved media-maintenance workflow or manual Shopify edit.",
        mediaId: media.id,
        observedAltText: altText,
        mediaMutationExcluded: true as const,
        requiredAction: "separate-approved-media-maintenance-workflow-or-manual-shopify-edit" as const,
      }];
    });
  }

  private validateInput(input: ControlledExecutionDryRunInput): void {
    if (
      Object.keys(input).sort().join("|") !== [...DRY_RUN_INPUT_KEYS].sort().join("|")
    ) {
      throw new ControlledExecutionError(
        "EXTRA_EXECUTION_INPUT",
        "Dry-run execution received unsupported input fields.",
      );
    }

    if (input.executionMode !== "dry-run-controlled-safe-update") {
      throw new ControlledExecutionError("INVALID_EXECUTION_MODE", `Unsupported dry-run mode: ${String(input.executionMode)}.`);
    }

    if (
      !Number.isInteger(input.tokenTtlSeconds) ||
      input.tokenTtlSeconds < MIN_TOKEN_TTL_SECONDS ||
      input.tokenTtlSeconds > MAX_TOKEN_TTL_SECONDS
    ) {
      throw new ControlledExecutionError(
        "INVALID_EXECUTION_REQUEST",
        `Review token TTL must be between ${MIN_TOKEN_TTL_SECONDS} and ${MAX_TOKEN_TTL_SECONDS} seconds.`,
      );
    }

    this.validateApprovedUpdateIdentity(input.approvedUpdate, input);
  }

  private validateApprovedUpdateIdentity(
    command: SafeShopifyProductUpdateCommand,
    input: ControlledExecutionDryRunInput,
  ): void {
    if (
      command.shopDomain !== input.storeDomain ||
      command.locator.kind !== "id" ||
      command.locator.productId !== input.productId
    ) {
      throw new ControlledExecutionError(
        "PREFLIGHT_MISMATCH",
        "Approved Shopify payload identity does not match the dry-run target.",
      );
    }

    const price = Number(command.pricing.price);
    const compareAtPrice = Number(command.pricing.compareAtPrice);
    if (
      !Number.isFinite(price) ||
      !Number.isFinite(compareAtPrice) ||
      price < 0 ||
      compareAtPrice <= price
    ) {
      throw new ControlledExecutionError(
        "INVALID_PROPOSAL",
        "Approved pricing must contain finite values with compare-at price greater than price.",
      );
    }
  }
}
