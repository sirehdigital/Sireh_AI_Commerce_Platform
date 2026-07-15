import type { SafeShopifyProductUpdateCommand } from "../../../integrations/shopify/shopify-product-update.types.js";
import type { ProductPreparationBrandContext, ProductPreparationProposal, ProductPreparationRequirement } from "../workflows/product-preparation/index.js";
import type { ShopifyDraftPreparationProductSnapshot } from "../workflows/shopify-draft-preparation/index.js";
import type { ApprovalToken } from "./approval-token.js";
import type { ControlledSafeUpdateExecutionRequest } from "./execution-request.js";
import type { HtmlVerificationResult } from "./verification/index.js";
import type { TagReconciliationPolicy, TagReconciliationPreview } from "./tag-reconciliation/index.js";

export interface ControlledExecutionDryRunInput extends Readonly<Record<string, unknown>> {
  readonly executionMode: "dry-run-controlled-safe-update";
  readonly storeDomain: `${string}.myshopify.com`;
  readonly productId: string;
  readonly approvedUpdate: SafeShopifyProductUpdateCommand;
  readonly approvedTags: readonly string[];
  readonly tagPolicy: TagReconciliationPolicy;
  readonly brandContext: ProductPreparationBrandContext;
  readonly tokenTtlSeconds: number;
}

export interface ControlledExecutionDryRunPreflightReport {
  readonly workflowMatched: true;
  readonly storeMatched: true;
  readonly productIdMatched: true;
  readonly handleMatched: true;
  readonly statusIsDraft: true;
  readonly approvedFieldScopeMatched: true;
  readonly variantIdsMatched: true;
  readonly skusMatched: true;
  readonly inventoryItemIdsMatched: true;
  readonly inventoryTrackingMatched: true;
  readonly inventoryPoliciesMatched: true;
  readonly locationsMatched: true;
  readonly collectionGidsValidated: true;
  readonly pricingScopeValidated: true;
  readonly templateValidated: true;
  readonly targetStatusIsDraft: true;
  readonly semanticHtmlVerificationReady: true;
  readonly tagPolicyValidated: true;
  readonly executionBlockedByTagPolicy: boolean;
  readonly passed: true;
}

export interface ControlledExecutionDryRunWarning {
  readonly code: "MEDIA_ALT_TEXT_OBSERVATION";
  readonly severity: "non-blocking";
  readonly message: string;
  readonly mediaId: string;
  readonly observedAltText: string;
  readonly mediaMutationExcluded: true;
  readonly requiredAction: "separate-approved-media-maintenance-workflow-or-manual-shopify-edit";
}

export interface ControlledExecutionDryRunSafetyReport {
  readonly shopifyReadExecuted: true;
  readonly shopifyProductUpdateServiceCalled: false;
  readonly shopifyMutationExecuted: false;
  readonly publicationExecuted: false;
  readonly inventoryMutation: false;
  readonly themeMutation: false;
  readonly mediaMutation: false;
  readonly metafieldMutation: false;
  readonly humanApprovalRequired: true;
  readonly executionBlocked: boolean;
  readonly reviewTokenExecutable: false;
  readonly secretsRedacted: true;
}

export interface ControlledExecutionDryRunResult extends Readonly<Record<string, unknown>> {
  readonly executionMode: "dry-run-controlled-safe-update";
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly snapshot: ShopifyDraftPreparationProductSnapshot;
  readonly approvedProposal: ProductPreparationProposal;
  readonly proposalHash: string;
  readonly approvalToken: ApprovalToken;
  readonly approvalTokenSummary: {
    readonly workflowId: string;
    readonly proposalHash: string;
    readonly approvedBy: string;
    readonly approvedAt: string;
    readonly expiresAt: string;
    readonly approvalScope: ApprovalToken["approvalScope"];
    readonly reviewOnly: true;
  };
  readonly mutationReadyExecutionRequest: ControlledSafeUpdateExecutionRequest;
  readonly htmlVerification: HtmlVerificationResult;
  readonly tagReconciliation: TagReconciliationPreview;
  readonly warnings: readonly ControlledExecutionDryRunWarning[];
  readonly preflightReport: ControlledExecutionDryRunPreflightReport;
  readonly preservationRequirements: readonly ProductPreparationRequirement[];
  readonly blockedFields: readonly string[];
  readonly safetyReport: ControlledExecutionDryRunSafetyReport;
}
