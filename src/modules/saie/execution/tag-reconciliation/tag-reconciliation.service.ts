import { ControlledExecutionError } from "../execution-errors.js";
import type {
  TagReconciliationInput,
  TagReconciliationPolicy,
  TagReconciliationPreview,
} from "./tag-reconciliation.types.js";

const TAG_POLICIES = new Set<TagReconciliationPolicy>([
  "merge",
  "exact-approved-set",
  "preserve-existing",
]);

export class TagReconciliationService {
  public preview(input: TagReconciliationInput): TagReconciliationPreview {
    if (!TAG_POLICIES.has(input.policy)) {
      throw new ControlledExecutionError(
        "INVALID_PROPOSAL",
        `Unsupported or ambiguous tag reconciliation policy: ${String(input.policy)}.`,
      );
    }

    const existingTags = this.normalize(input.existingTags);
    const approvedTags = this.normalize(input.approvedTags);
    const existingByKey = new Map(existingTags.map((tag) => [tag.toLowerCase(), tag]));
    const approvedByKey = new Map(approvedTags.map((tag) => [tag.toLowerCase(), tag]));

    if (input.policy === "preserve-existing") {
      return {
        policy: input.policy,
        existingTags,
        approvedTags,
        tagsToAdd: [],
        tagsToRetain: existingTags,
        tagsToRemove: [],
        finalExpectedTags: existingTags,
        executionSupportedByMergeOnlyService: true,
      };
    }

    const tagsToAdd = approvedTags.filter((tag) => !existingByKey.has(tag.toLowerCase()));
    const tagsToRetain = approvedTags.filter((tag) => existingByKey.has(tag.toLowerCase()));

    if (input.policy === "merge") {
      return {
        policy: input.policy,
        existingTags,
        approvedTags,
        tagsToAdd,
        tagsToRetain: existingTags,
        tagsToRemove: [],
        finalExpectedTags: this.normalize([...existingTags, ...approvedTags]),
        executionSupportedByMergeOnlyService: true,
      };
    }

    const tagsToRemove = existingTags.filter((tag) => !approvedByKey.has(tag.toLowerCase()));
    return {
      policy: input.policy,
      existingTags,
      approvedTags,
      tagsToAdd,
      tagsToRetain,
      tagsToRemove,
      finalExpectedTags: approvedTags,
      executionSupportedByMergeOnlyService: false,
      executionBlockReason:
        "The reused ShopifyProductUpdateService supports merge-only tag updates and cannot guarantee exact tag replacement.",
    };
  }

  private normalize(values: readonly string[]): readonly string[] {
    const unique = new Map<string, string>();
    for (const value of values) {
      const tag = value.trim();
      if (tag.length > 0 && !unique.has(tag.toLowerCase())) {
        unique.set(tag.toLowerCase(), tag);
      }
    }
    return [...unique.values()].sort((left, right) =>
      left.toLowerCase().localeCompare(right.toLowerCase()),
    );
  }
}
