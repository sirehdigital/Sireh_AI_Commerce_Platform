import type { ProductPreparationTagPolicy } from "../../workflows/product-preparation/index.js";

export type TagReconciliationPolicy = ProductPreparationTagPolicy;

export interface TagReconciliationInput {
  readonly policy: TagReconciliationPolicy;
  readonly existingTags: readonly string[];
  readonly approvedTags: readonly string[];
}

export interface TagReconciliationPreview {
  readonly policy: TagReconciliationPolicy;
  readonly existingTags: readonly string[];
  readonly approvedTags: readonly string[];
  readonly tagsToAdd: readonly string[];
  readonly tagsToRetain: readonly string[];
  readonly tagsToRemove: readonly string[];
  readonly finalExpectedTags: readonly string[];
  readonly executionSupportedByMergeOnlyService: boolean;
  readonly executionBlockReason?: string;
}
