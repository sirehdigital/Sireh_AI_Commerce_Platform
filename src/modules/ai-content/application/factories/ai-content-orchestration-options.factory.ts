import type {
  AIContentOrchestrationInput,
  AIContentOrchestrationOptions,
  AIContentOrchestrationOptionsInput,
  AIContentStageId,
} from "../dto/ai-content-orchestration.types.js";
import {
  InvalidAIContentOrchestrationInputError,
  InvalidAIContentOrchestrationOptionsError,
} from "../errors/ai-content-orchestration.errors.js";

export class AIContentOrchestrationOptionsFactory {
  public create(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptionsInput = {},
  ): AIContentOrchestrationOptions {
    this.validateInput(input);
    const failFastMode = options.failFastMode ?? false;
    const partialSuccessMode = options.partialSuccessMode ?? !failFastMode;
    if (failFastMode === partialSuccessMode) {
      throw new InvalidAIContentOrchestrationOptionsError(
        "Exactly one of fail-fast mode or partial-success mode must be enabled.",
      );
    }

    const enabledStages: AIContentStageId[] = ["input-validation"];
    add(enabledStages, "product-content", options.generateProductContent ?? true);
    add(enabledStages, "seo-content", options.generateSEOContent ?? true);
    add(enabledStages, "social-content", options.generateSocialContent ?? true);
    add(enabledStages, "video-content", options.generateVideoContent ?? true);
    add(enabledStages, "email-content", options.generateEmailContent ?? true);
    add(enabledStages, "blog-content", options.generateBlogContent ?? true);
    add(enabledStages, "quality-scoring", options.scoreGeneratedContent ?? true);
    add(enabledStages, "quality-gate", options.applyQualityGate ?? true);
    add(enabledStages, "localization", options.localizeApprovedContent ?? false);
    enabledStages.push("portfolio-assembly");

    const minimumApprovalScore = score(options.minimumApprovalScore ?? 75, "minimumApprovalScore");
    const minimumPublicationScore = score(
      options.minimumPublicationScore ?? 85,
      "minimumPublicationScore",
    );
    if (minimumPublicationScore < minimumApprovalScore) {
      throw new InvalidAIContentOrchestrationOptionsError(
        "Minimum publication score cannot be lower than minimum approval score.",
      );
    }

    const targetLocales = unique(options.targetLocales ?? input.targetLocales ?? []);
    if (enabledStages.includes("localization") && targetLocales.length === 0) {
      throw new InvalidAIContentOrchestrationOptionsError(
        "At least one target locale is required when localization is enabled.",
      );
    }

    return {
      enabledStages,
      selectedSocialPlatforms: unique(options.selectedSocialPlatforms ?? ["generic"]),
      selectedVideoConfigurations: uniqueBy(
        options.selectedVideoConfigurations ?? [
          { platform: "generic-video", format: "standard-product-video" },
        ],
        (item) => `${item.platform}:${item.format}`,
      ),
      selectedEmailCampaignTypes: unique(options.selectedEmailCampaignTypes ?? ["promotional"]),
      selectedBlogArticleTypes: unique(options.selectedBlogArticleTypes ?? ["product-guide"]),
      targetLocales,
      ...(options.contentTone === undefined ? {} : { contentTone: options.contentTone }),
      strictSafetyMode: options.strictSafetyMode ?? true,
      strictQualityMode: options.strictQualityMode ?? true,
      failurePolicy: failFastMode ? "fail-fast" : "partial-success",
      qualityGatePolicy:
        options.qualityGatePolicy ?? (options.strictQualityMode === false ? "advisory" : "strict"),
      minimumApprovalScore,
      minimumPublicationScore,
      maximumWarnings: count(options.maximumWarnings ?? 20, "maximumWarnings"),
      maximumCriticalIssues: count(options.maximumCriticalIssues ?? 0, "maximumCriticalIssues"),
      qualityProfiles: { ...(options.qualityProfiles ?? {}) },
      includeAuditTrail: options.includeAuditTrail ?? true,
      includeExecutionMetrics: options.includeExecutionMetrics ?? true,
      includeSkippedStageReasons: options.includeSkippedStageReasons ?? true,
      includeRawIntermediatePackages: options.includeRawIntermediatePackages ?? true,
      includeLocalizedPackages: options.includeLocalizedPackages ?? true,
    };
  }

  private validateInput(input: AIContentOrchestrationInput): void {
    if (input.correlationId.trim().length === 0) {
      throw new InvalidAIContentOrchestrationInputError("Correlation ID is required.");
    }
    if (
      input.product.product.id.trim().length === 0 ||
      input.product.product.title.trim().length === 0
    ) {
      throw new InvalidAIContentOrchestrationInputError(
        "A normalized product with an ID and title is required.",
      );
    }
  }
}

function add(stages: AIContentStageId[], stage: AIContentStageId, enabled: boolean): void {
  if (enabled) stages.push(stage);
}

function score(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new InvalidAIContentOrchestrationOptionsError(`${field} must be between 0 and 100.`, {
      field,
      value,
    });
  }
  return Math.round(value);
}

function count(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidAIContentOrchestrationOptionsError(`${field} must be zero or greater.`, {
      field,
      value,
    });
  }
  return Math.trunc(value);
}

function unique<T>(items: readonly T[]): readonly T[] {
  return [...new Set(items)];
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): readonly T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
