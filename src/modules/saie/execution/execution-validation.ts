import type {
  SafeShopifyProductUpdateAudit,
  SafeShopifyProductUpdateCommand,
} from "../../../integrations/shopify/shopify-product-update.types.js";
import { PRODUCT_PREPARATION_EXCLUDED_MUTATIONS } from "../workflows/product-preparation/product-preparation.steps.js";
import type { ProductPreparationProposal } from "../workflows/product-preparation/index.js";
import {
  ShopifyPreservationSnapshotBuilder,
  validateShopifyProductSnapshot,
  type ShopifyDraftPreparationInput,
  type ShopifyDraftPreparationProductSnapshot,
} from "../workflows/shopify-draft-preparation/index.js";
import {
  CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS,
  REVIEW_ONLY_APPROVER,
  calculateProposalHash,
} from "./approval-token.js";
import { ControlledExecutionError } from "./execution-errors.js";
import type { ControlledSafeUpdateExecutionRequest } from "./execution-request.js";
import type { ControlledExecutionPreservationVerification } from "./execution-result.js";
import { TagReconciliationService } from "./tag-reconciliation/index.js";

const REQUEST_KEYS = [
  "approvalToken",
  "approvedProposal",
  "brandContext",
  "executionMode",
  "productId",
  "storeDomain",
] as const;
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/u;
const PRODUCT_ID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/u;
const COLLECTION_ID_PATTERN = /^gid:\/\/shopify\/Collection\/\d+$/u;

export interface ControlledExecutionPreflight {
  readonly command: SafeShopifyProductUpdateCommand;
  readonly proposalHash: string;
}

export interface ControlledExecutionPreflightOptions {
  readonly allowUnsupportedTagPolicyPreview?: boolean;
}

export const validateApprovalToken = (
  request: ControlledSafeUpdateExecutionRequest,
  now: Date,
): string => {
  const { approvalToken, approvedProposal } = request;
  const proposalHash = calculateProposalHash(approvedProposal);
  const approvedAt = Date.parse(approvalToken.approvedAt);
  const expiresAt = Date.parse(approvalToken.expiresAt);

  if (
    approvalToken.approvedBy.trim().length === 0 ||
    approvalToken.approvedBy === REVIEW_ONLY_APPROVER ||
    !Number.isFinite(approvedAt) ||
    !Number.isFinite(expiresAt) ||
    approvedAt > expiresAt ||
    approvedAt > now.getTime()
  ) {
    throw new ControlledExecutionError("INVALID_APPROVAL_TOKEN", "Approval token metadata is invalid.");
  }

  if (expiresAt <= now.getTime()) {
    throw new ControlledExecutionError("APPROVAL_EXPIRED", "Approval token has expired.");
  }

  if (approvalToken.workflowId !== approvedProposal.workflowId) {
    throw new ControlledExecutionError("APPROVAL_SCOPE_MISMATCH", "Approval workflow does not match the proposal.");
  }

  if (approvalToken.proposalHash !== proposalHash) {
    throw new ControlledExecutionError("APPROVAL_SCOPE_MISMATCH", "Approval proposal hash does not match the proposal.");
  }

  const scope = approvalToken.approvalScope;
  const proposalTagPolicy = approvedProposal.safeUpdateProposal?.tagPolicy;
  if (proposalTagPolicy === undefined) {
    throw new ControlledExecutionError(
      "INVALID_PROPOSAL",
      "Proposal requires a safe update payload with an explicit tag policy.",
    );
  }
  const approvedFields = [...scope.approvedFields].sort();
  const requiredFields = [...CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS].sort();

  if (
    scope.executionMode !== "controlled-safe-update" ||
    scope.storeDomain !== request.storeDomain ||
    scope.productId !== request.productId ||
    scope.targetStatus !== "DRAFT" ||
    scope.tagPolicy !== proposalTagPolicy ||
    !sameArray(approvedFields, requiredFields)
  ) {
    throw new ControlledExecutionError("APPROVAL_SCOPE_MISMATCH", "Approval scope does not match this execution.");
  }

  return proposalHash;
};

export const validateReviewApprovalToken = (
  request: ControlledSafeUpdateExecutionRequest,
  now: Date,
): string => {
  if (request.approvalToken.approvedBy !== REVIEW_ONLY_APPROVER) {
    throw new ControlledExecutionError(
      "INVALID_APPROVAL_TOKEN",
      "Dry-run review tokens must use the non-executable review approver marker.",
    );
  }

  const reviewRequest: ControlledSafeUpdateExecutionRequest = {
    ...request,
    approvalToken: {
      ...request.approvalToken,
      approvedBy: "dry-run-structural-validation",
    },
  };

  return validateApprovalToken(reviewRequest, now);
};

export const validateControlledExecutionRequest = (
  request: ControlledSafeUpdateExecutionRequest,
): void => {
  const keys = Object.keys(request).sort();
  if (!sameArray(keys, [...REQUEST_KEYS])) {
    throw new ControlledExecutionError(
      "EXTRA_EXECUTION_INPUT",
      "Controlled execution accepts only the approved proposal, approval token, product ID, store domain, brand context, and execution mode.",
    );
  }

  if (request.executionMode !== "controlled-safe-update") {
    throw new ControlledExecutionError("INVALID_EXECUTION_MODE", `Unsupported execution mode: ${String(request.executionMode)}.`);
  }

  if (!SHOP_DOMAIN_PATTERN.test(request.storeDomain) || !PRODUCT_ID_PATTERN.test(request.productId)) {
    throw new ControlledExecutionError("INVALID_EXECUTION_REQUEST", "Store domain or Shopify product ID is invalid.");
  }
};

export const validateExecutionPreflight = (
  request: ControlledSafeUpdateExecutionRequest,
  snapshot: ShopifyDraftPreparationProductSnapshot,
  proposalHash: string,
  options: ControlledExecutionPreflightOptions = {},
): ControlledExecutionPreflight => {
  validateSnapshotWithExistingRules(request, snapshot);
  const proposal = request.approvedProposal;
  const safeUpdate = proposal.safeUpdateProposal;

  if (
    proposal.executionMode !== "proposal-only" ||
    proposal.approvalStatus !== "required" ||
    proposal.mutationExecuted ||
    proposal.publicationExecuted ||
    !proposal.readyForHumanReview ||
    safeUpdate === undefined
  ) {
    throw new ControlledExecutionError("INVALID_PROPOSAL", "Proposal is not an approved, mutation-free SAIE preparation proposal.");
  }

  if (snapshot.status !== "DRAFT" || safeUpdate.targetStatus !== "DRAFT") {
    throw new ControlledExecutionError("PREFLIGHT_MISMATCH", "Controlled execution supports existing Shopify Draft products only.");
  }

  if (proposal.productReference.sourceId !== request.productId || snapshot.id !== request.productId) {
    throw new ControlledExecutionError("PREFLIGHT_MISMATCH", "Product ID does not match the approved proposal and Shopify snapshot.");
  }

  if (!proposal.productReference.sourceUrl.startsWith(`shopify://${request.storeDomain}/`)) {
    throw new ControlledExecutionError("PREFLIGHT_MISMATCH", "Proposal source store does not match the execution store.");
  }

  validatePreservationRequirements(proposal, snapshot);
  validateProposalSafety(request, safeUpdate.excludedMutations);
  validateTagPolicy(snapshot.tags, safeUpdate, options);

  const requiredText = [
    ["title", safeUpdate.title],
    ["descriptionHtml", safeUpdate.descriptionHtml],
    ["vendor", safeUpdate.vendor],
    ["productType", safeUpdate.productType],
    ["seoTitle", safeUpdate.seoTitle],
    ["seoDescription", safeUpdate.seoDescription],
  ] as const;

  for (const [field, value] of requiredText) {
    if (value === undefined || value.trim().length === 0) {
      throw new ControlledExecutionError("INVALID_PROPOSAL", `Approved proposal is missing ${field}.`);
    }
  }

  if (safeUpdate.pricing === undefined) {
    throw new ControlledExecutionError("INVALID_PROPOSAL", "Approved proposal is missing existing-service pricing input.");
  }

  if (safeUpdate.pricing.currency !== snapshot.storeCurrency || safeUpdate.pricing.currency !== request.brandContext.sellingCurrency) {
    throw new ControlledExecutionError("PREFLIGHT_MISMATCH", "Store, brand, and proposal currencies do not match.");
  }

  if (safeUpdate.templateSuffix !== request.brandContext.templateSuffix || safeUpdate.vendor !== request.brandContext.brandName) {
    throw new ControlledExecutionError("PREFLIGHT_MISMATCH", "Approved template or vendor does not match the brand context.");
  }

  if (!safeUpdate.collectionReferences.every((reference) => COLLECTION_ID_PATTERN.test(reference))) {
    throw new ControlledExecutionError("INVALID_PROPOSAL", "Collection references must be exact Shopify Collection GIDs before execution.");
  }

  if (!sameSet(safeUpdate.collectionReferences, request.brandContext.preferredCollections)) {
    throw new ControlledExecutionError("PREFLIGHT_MISMATCH", "Approved collections do not match the resolved brand context.");
  }

  return {
    proposalHash,
    command: {
      shopDomain: request.storeDomain,
      locator: { kind: "id", productId: request.productId },
      title: safeUpdate.title!,
      descriptionHtml: safeUpdate.descriptionHtml!,
      vendor: safeUpdate.vendor,
      productType: safeUpdate.productType!,
      tagsToAdd: [...safeUpdate.tagsToAdd],
      seo: { title: safeUpdate.seoTitle!, description: safeUpdate.seoDescription! },
      pricing: {
        price: safeUpdate.pricing.price.toFixed(2),
        compareAtPrice: safeUpdate.pricing.compareAtPrice.toFixed(2),
      },
      collectionIdsToJoin: [...safeUpdate.collectionReferences],
      templateSuffix: safeUpdate.templateSuffix,
    },
  };
};

const validateTagPolicy = (
  existingTags: readonly string[],
  safeUpdate: NonNullable<ProductPreparationProposal["safeUpdateProposal"]>,
  options: ControlledExecutionPreflightOptions,
): void => {
  const preview = new TagReconciliationService().preview({
    policy: safeUpdate.tagPolicy,
    existingTags,
    approvedTags: safeUpdate.approvedTags,
  });

  if (safeUpdate.tagPolicy === "preserve-existing" && safeUpdate.tagsToAdd.length > 0) {
    throw new ControlledExecutionError(
      "INVALID_PROPOSAL",
      "Preserve-existing tag policy cannot contain tags to add.",
    );
  }

  if (safeUpdate.tagPolicy === "exact-approved-set" && !sameSet(safeUpdate.tagsToAdd, preview.tagsToAdd)) {
    throw new ControlledExecutionError(
      "PREFLIGHT_MISMATCH",
      "Exact-approved-set proposal additions do not match the live tag reconciliation preview.",
    );
  }

  if (safeUpdate.tagPolicy === "merge") {
    const additionsCovered = preview.tagsToAdd.every((tag) =>
      safeUpdate.tagsToAdd.some((candidate) => candidate.toLowerCase() === tag.toLowerCase()),
    );
    const onlyApprovedTags = safeUpdate.tagsToAdd.every((tag) =>
      safeUpdate.approvedTags.some((candidate) => candidate.toLowerCase() === tag.toLowerCase()),
    );
    if (!additionsCovered || !onlyApprovedTags) {
      throw new ControlledExecutionError(
        "PREFLIGHT_MISMATCH",
        "Merge tag proposal does not match the approved tag scope.",
      );
    }
  }

  if (
    !preview.executionSupportedByMergeOnlyService &&
    options.allowUnsupportedTagPolicyPreview !== true
  ) {
    throw new ControlledExecutionError(
      "TAG_POLICY_UNSUPPORTED",
      preview.executionBlockReason ?? "Selected tag policy is not supported for controlled execution.",
    );
  }
};

export const verifyExecutionReadBack = (
  before: ShopifyDraftPreparationProductSnapshot,
  after: ShopifyDraftPreparationProductSnapshot,
  audit: SafeShopifyProductUpdateAudit,
): ControlledExecutionPreservationVerification => {
  const beforeState = new ShopifyPreservationSnapshotBuilder().build(before);
  const afterState = new ShopifyPreservationSnapshotBuilder().build(after);
  const verification: ControlledExecutionPreservationVerification = {
    productIdUnchanged: before.id === after.id && audit.productId === before.id,
    handleUnchanged: before.handle === after.handle && audit.preservation.handlePreserved,
    variantIdsUnchanged: sameSet(beforeState.variantIds, afterState.variantIds) && audit.preservation.variantIdsPreserved,
    skusUnchanged: sameByVariant(before, after, "sku") && audit.preservation.skusPreserved,
    inventoryItemIdsUnchanged:
      sameByVariant(before, after, "inventoryItemId") && audit.preservation.inventoryItemIdsPreserved,
    inventoryTrackingUnchanged:
      sameByVariant(before, after, "inventoryTracked") && audit.preservation.inventoryTrackingPreserved,
    inventoryPoliciesUnchanged:
      sameByVariant(before, after, "inventoryPolicy") && audit.preservation.inventoryPoliciesPreserved,
    locationsUnchanged: sameValue(beforeState.inventoryLocations, afterState.inventoryLocations),
    autoDSLinkPreserved: false,
    statusIsDraft: after.status === "DRAFT" && audit.after.status === "DRAFT",
    noPublication: audit.preservation.publicationMutationExecuted === false && after.status === "DRAFT",
  };
  const autoDSLinkPreserved = Object.entries(verification)
    .filter(([key]) => !["autoDSLinkPreserved", "statusIsDraft", "noPublication"].includes(key))
    .every(([, value]) => value);

  return { ...verification, autoDSLinkPreserved };
};

export const assertExecutionReadBack = (
  verification: ControlledExecutionPreservationVerification,
): void => {
  const failures = Object.entries(verification).filter(([, passed]) => !passed).map(([name]) => name);
  if (failures.length > 0) {
    throw new ControlledExecutionError("READBACK_MISMATCH", "Post-execution preservation verification failed.", { failures });
  }
};

const validateSnapshotWithExistingRules = (
  request: ControlledSafeUpdateExecutionRequest,
  snapshot: ShopifyDraftPreparationProductSnapshot,
): void => {
  const validationInput: ShopifyDraftPreparationInput = {
    executionMode: "shopify-draft-preparation",
    shopDomain: request.storeDomain,
    productLocator: { kind: "product-id", productId: request.productId },
    brandContext: request.brandContext,
    requestedCapabilities: {
      normalize: false,
      analyze: false,
      assessRisk: false,
      generateBranding: false,
      generateCopy: false,
      recommendPricing: false,
      mapForShopify: false,
      prepareSafeUpdateProposal: false,
    },
  };

  try {
    validateShopifyProductSnapshot(snapshot, validationInput);
  } catch (error) {
    throw new ControlledExecutionError(
      "PREFLIGHT_MISMATCH",
      error instanceof Error ? error.message : "Shopify preflight snapshot is invalid.",
    );
  }
};

const validatePreservationRequirements = (
  proposal: ProductPreparationProposal,
  snapshot: ShopifyDraftPreparationProductSnapshot,
): void => {
  const state = new ShopifyPreservationSnapshotBuilder().build(snapshot);
  const checks: readonly [string, unknown][] = [
    ["exact product ID", state.productId],
    ["exact handle", state.handle],
    ["variant IDs", state.variantIds],
    ["variant SKUs", state.variantSkus],
    ["inventory item IDs", state.inventoryItemIds],
    ["inventory tracking", state.inventoryTracked],
    ["inventory policies", state.inventoryPolicies],
    ["inventory locations and quantities", state.inventoryLocations],
    ["collection IDs", state.collectionIds],
    ["template suffix", state.templateSuffix],
    ["store currency", state.storeCurrency],
  ];

  for (const [subject, actual] of checks) {
    const requirement = proposal.preservationRequirements.find((item) => item.subject === subject);
    if (requirement === undefined || !sameValue(requirement.expectedValue, actual)) {
      throw new ControlledExecutionError("PREFLIGHT_MISMATCH", `Preservation preflight failed for ${subject}.`);
    }
  }
};

const validateProposalSafety = (
  request: ControlledSafeUpdateExecutionRequest,
  excludedMutations: readonly string[],
): void => {
  const missingExclusions = PRODUCT_PREPARATION_EXCLUDED_MUTATIONS.filter(
    (required) => !excludedMutations.includes(required),
  );
  if (missingExclusions.length > 0) {
    throw new ControlledExecutionError("INVALID_PROPOSAL", "Proposal does not preserve every protected Shopify mutation boundary.", {
      missingExclusions,
    });
  }

  if (request.approvalToken.approvalScope.targetStatus !== "DRAFT") {
    throw new ControlledExecutionError("APPROVAL_SCOPE_MISMATCH", "Approval must force DRAFT status.");
  }
};

const sameByVariant = (
  before: ShopifyDraftPreparationProductSnapshot,
  after: ShopifyDraftPreparationProductSnapshot,
  field: "sku" | "inventoryItemId" | "inventoryTracked" | "inventoryPolicy",
): boolean => {
  const afterVariants = new Map(after.variants.map((variant) => [variant.id, variant]));
  return before.variants.every((variant) => afterVariants.get(variant.id)?.[field] === variant[field]);
};

const sameArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const sameSet = (left: readonly string[], right: readonly string[]): boolean =>
  sameArray([...left].sort(), [...right].sort());

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
