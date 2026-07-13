import { describe, expect, it } from "vitest";
import {
  AIContentStageExecutionError,
  MissingAIContentDependencyError,
  type AIContentOrchestratorDependencies,
} from "../index.js";
import { buildOrchestrationInput } from "./builders/orchestration-input.builder.js";
import { failureFixtures } from "./fixtures/product.fixtures.js";
import {
  createAIContentIntegrationHarness,
  createIntegrationDependencies,
} from "./harness/ai-content-integration.harness.js";

describe("AI Content failure and safety integration", () => {
  it.each([
    ["productContent", {}],
    ["seoContent", {}],
    ["socialContent", {}],
    ["videoContent", {}],
    ["emailContent", {}],
    ["blogContent", {}],
    ["qualityScoring", {}],
    [
      "localization",
      {
        localizeApprovedContent: true,
        targetLocales: ["ms-MY"],
        minimumApprovalScore: 0,
        minimumPublicationScore: 0,
        maximumWarnings: 100,
        maximumCriticalIssues: 100,
      },
    ],
  ] as const)("fails fast when %s fails", (dependency, optionOverrides) => {
    const harness = createAIContentIntegrationHarness(failingDependency(dependency));
    expect(() =>
      harness.orchestrate(buildOrchestrationInput(), {
        failFastMode: true,
        partialSuccessMode: false,
        ...optionOverrides,
      }),
    ).toThrow(AIContentStageExecutionError);
  });

  it("retains successful platform output and controlled errors under partial success", () => {
    const dependencies = createIntegrationDependencies();
    let callCount = 0;
    const harness = createAIContentIntegrationHarness({
      socialContent: {
        execute: (request) => {
          callCount += 1;
          if (callCount === 2) throw new Error("controlled social platform failure");
          return dependencies.socialContent.execute(request);
        },
      },
    });
    const result = harness.orchestrate(buildOrchestrationInput(), {
      selectedSocialPlatforms: ["instagram", "facebook"],
      generateVideoContent: false,
      generateEmailContent: false,
      generateBlogContent: false,
      scoreGeneratedContent: false,
      applyQualityGate: false,
      failFastMode: false,
      partialSuccessMode: true,
    });

    expect(result.socialContentPackages).toHaveLength(1);
    expect(
      result.errors.some((error) => error.message === "controlled social platform failure"),
    ).toBe(true);
    expect(result.readiness).toBe("partial");
    expect(result.approvalReady).toBe(false);
  });

  it("rejects disabled required dependencies and unsupported localization", () => {
    expect(() =>
      createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
        generateProductContent: false,
        generateSEOContent: true,
      }),
    ).toThrow(MissingAIContentDependencyError);

    expect(() =>
      createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
        generateSEOContent: false,
        generateSocialContent: false,
        generateVideoContent: false,
        generateEmailContent: false,
        generateBlogContent: false,
        scoreGeneratedContent: false,
        applyQualityGate: false,
        localizeApprovedContent: true,
        targetLocales: [failureFixtures.invalidLocale as "en-US"],
        failFastMode: true,
        partialSuccessMode: false,
      }),
    ).toThrow(AIContentStageExecutionError);
  });

  it("blocks unsafe claims and invalid personalization tokens from reaching an approved portfolio", () => {
    const unsafe = buildOrchestrationInput({
      product: {
        ...buildOrchestrationInput().product,
        product: {
          ...buildOrchestrationInput().product.product,
          title: failureFixtures.unsafeClaim,
        },
        copy: {
          ...buildOrchestrationInput().product.copy!,
          brandedTitle: failureFixtures.unsafeClaim,
          fullDescription: failureFixtures.unsafeClaim,
        },
      },
    });
    expect(() =>
      createAIContentIntegrationHarness().orchestrate(unsafe, {
        failFastMode: true,
        partialSuccessMode: false,
      }),
    ).toThrow(AIContentStageExecutionError);

    const invalidToken = buildOrchestrationInput({
      emailOptions: { personalizationTokens: [failureFixtures.invalidPersonalizationToken] },
    });
    expect(() =>
      createAIContentIntegrationHarness().orchestrate(invalidToken, {
        generateSocialContent: false,
        generateVideoContent: false,
        generateBlogContent: false,
        scoreGeneratedContent: false,
        applyQualityGate: false,
        failFastMode: true,
        partialSuccessMode: false,
      }),
    ).toThrow(AIContentStageExecutionError);
  });
});

function failingDependency(
  key: keyof AIContentOrchestratorDependencies,
): Partial<AIContentOrchestratorDependencies> {
  const failure = {
    execute: (): never => {
      throw new Error(`controlled ${key} failure`);
    },
  };
  return { [key]: failure };
}
