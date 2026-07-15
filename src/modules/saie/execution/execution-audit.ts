import type {
  ControlledExecutionRollbackReport,
  ControlledExecutionSafetyReport,
} from "./execution-result.js";

export const CONTROLLED_EXECUTION_SKIPPED_FIELDS = [
  "product creation",
  "product deletion",
  "product publication",
  "handle",
  "variant creation or recreation",
  "variant identity",
  "SKU",
  "inventory item",
  "inventory tracking",
  "inventory quantity",
  "inventory location",
  "fulfillment mapping",
  "supplier linkage",
  "AutoDS linkage",
  "media",
  "theme",
  "metafields",
] as const;

export const createExecutionSafetyReport = (input: {
  readonly humanApprovalVerified: boolean;
  readonly shopifyMutationExecuted: boolean | "unknown";
  readonly autoDSLinkPreserved: boolean;
}): ControlledExecutionSafetyReport => ({
  humanApprovalVerified: input.humanApprovalVerified,
  shopifyMutationExecuted: input.shopifyMutationExecuted,
  publicationExecuted: false,
  inventoryMutation: false,
  variantRecreation: false,
  skuMutation: false,
  autoDSLinkPreserved: input.autoDSLinkPreserved,
  themeMutation: false,
  mediaMutation: false,
  metafieldMutation: false,
});

export const createRollbackReport = (
  mutationCompleted: boolean,
): ControlledExecutionRollbackReport =>
  mutationCompleted
    ? {
        attempted: false,
        status: "not-required",
        reason: "The controlled update and read-back verification completed successfully.",
      }
    : {
        attempted: false,
        status: "not-supported",
        reason:
          "The existing Shopify update service is not transactional; the audit reports failure and requires operator review instead of issuing an unsafe compensating mutation.",
      };
