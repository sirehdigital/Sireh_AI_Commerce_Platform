import { describe, expect, it } from "vitest";

import { TagReconciliationService } from "./tag-reconciliation.service.js";

describe("TagReconciliationService", () => {
  const service = new TagReconciliationService();

  it("produces a deterministic merge preview", () => {
    const input = {
      policy: "merge" as const,
      existingTags: ["Hair Wellness", "Lumora Beauty"],
      approvedTags: ["Beauty Device", "Hair Wellness"],
    };
    expect(service.preview(input)).toEqual(service.preview(input));
    expect(service.preview(input)).toEqual(
      expect.objectContaining({
        tagsToAdd: ["Beauty Device"],
        tagsToRemove: [],
        finalExpectedTags: ["Beauty Device", "Hair Wellness", "Lumora Beauty"],
      }),
    );
  });

  it("identifies additions and removals for exact-approved-set", () => {
    const result = service.preview({
      policy: "exact-approved-set",
      existingTags: ["Hair Growth", "Hair Wellness", "Lumora Beauty"],
      approvedTags: ["Beauty Device", "Hair Wellness", "Lumora Beauty"],
    });
    expect(result.tagsToAdd).toEqual(["Beauty Device"]);
    expect(result.tagsToRetain).toEqual(["Hair Wellness", "Lumora Beauty"]);
    expect(result.tagsToRemove).toEqual(["Hair Growth"]);
    expect(result.finalExpectedTags).toEqual(["Beauty Device", "Hair Wellness", "Lumora Beauty"]);
    expect(result.executionSupportedByMergeOnlyService).toBe(false);
  });

  it("never removes or adds tags under preserve-existing", () => {
    const result = service.preview({
      policy: "preserve-existing",
      existingTags: ["Existing", "Protected"],
      approvedTags: ["Ignored"],
    });
    expect(result.tagsToAdd).toEqual([]);
    expect(result.tagsToRemove).toEqual([]);
    expect(result.finalExpectedTags).toEqual(["Existing", "Protected"]);
  });

  it("rejects an ambiguous tag policy", () => {
    expect(() =>
      service.preview({
        policy: "replace" as never,
        existingTags: [],
        approvedTags: [],
      }),
    ).toThrow("Unsupported or ambiguous");
  });
});
