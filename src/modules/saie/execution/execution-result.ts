import type { ShopifyProductAuditChange } from "../../../integrations/shopify/shopify-product-update.types.js";
import type { ShopifyDraftPreparationProductSnapshot } from "../workflows/shopify-draft-preparation/index.js";
import type { HtmlVerificationResult } from "./verification/index.js";

export interface ControlledExecutionPreservationVerification {
  readonly productIdUnchanged: boolean;
  readonly handleUnchanged: boolean;
  readonly variantIdsUnchanged: boolean;
  readonly skusUnchanged: boolean;
  readonly inventoryItemIdsUnchanged: boolean;
  readonly inventoryTrackingUnchanged: boolean;
  readonly inventoryPoliciesUnchanged: boolean;
  readonly locationsUnchanged: boolean;
  readonly autoDSLinkPreserved: boolean;
  readonly statusIsDraft: boolean;
  readonly noPublication: boolean;
}

export interface ControlledExecutionSafetyReport {
  readonly humanApprovalVerified: boolean;
  readonly shopifyMutationExecuted: boolean | "unknown";
  readonly publicationExecuted: false;
  readonly inventoryMutation: false;
  readonly variantRecreation: false;
  readonly skuMutation: false;
  readonly autoDSLinkPreserved: boolean;
  readonly themeMutation: false;
  readonly mediaMutation: false;
  readonly metafieldMutation: false;
}

export interface ControlledExecutionRollbackReport {
  readonly attempted: false;
  readonly status: "not-required" | "not-supported";
  readonly reason: string;
}

export interface ControlledSafeUpdateExecutionResult extends Readonly<Record<string, unknown>> {
  readonly executionId: string;
  readonly workflowId: string;
  readonly proposalHash: string;
  readonly approvedBy: string;
  readonly executionTime: string;
  readonly beforeSnapshot: ShopifyDraftPreparationProductSnapshot | null;
  readonly afterSnapshot: ShopifyDraftPreparationProductSnapshot | null;
  readonly preservationVerification: ControlledExecutionPreservationVerification | null;
  readonly descriptionHtmlVerification: HtmlVerificationResult | null;
  readonly changedFields: readonly ShopifyProductAuditChange[];
  readonly skippedFields: readonly string[];
  readonly warnings: readonly string[];
  readonly mutationCount: number | "unknown";
  readonly rollback: ControlledExecutionRollbackReport;
  readonly safetyReport: ControlledExecutionSafetyReport;
  readonly publicationExecuted: false;
  readonly inventoryMutation: false;
  readonly status: "SUCCESS" | "FAILED";
  readonly failureCode?: string;
}
