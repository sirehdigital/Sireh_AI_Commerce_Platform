import type { Content } from "../../domain/index.js";
import type {
  AIContentAuditRecord,
  AIContentExecutionMetrics,
  AIContentExecutionStage,
  AIContentLocalizationSummary,
  AIContentOrchestrationClock,
  AIContentOrchestrationInput,
  AIContentOrchestrationOptions,
  AIContentOrchestrationOptionsInput,
  AIContentPortfolio,
  AIContentPortfolioReadiness,
  AIContentQualityGateResult,
  AIContentStageIssue,
  AIContentStageResult,
} from "../dto/ai-content-orchestration.types.js";
import type { BlogContentPackage } from "../dto/blog-content.types.js";
import type { ContentQualityScorecard } from "../dto/content-quality-scoring.types.js";
import type { LocalizedContentPackage } from "../dto/content-localization.types.js";
import type { EmailContentPackage } from "../dto/email-content.types.js";
import type { ProductContentPackage } from "../dto/product-content.types.js";
import type { SEOContentPackage } from "../dto/seo-content.types.js";
import type { SocialMediaContentPackage } from "../dto/social-media-content.types.js";
import type { VideoScriptPackage } from "../dto/video-script.types.js";
import { AIContentStageExecutionError } from "../errors/ai-content-orchestration.errors.js";
import { AIContentExecutionPlanFactory } from "../factories/ai-content-execution-plan.factory.js";
import { AIContentOrchestrationOptionsFactory } from "../factories/ai-content-orchestration-options.factory.js";
import { AIContentOrchestrationMapper } from "../mappers/ai-content-orchestration.mapper.js";
import type { AIContentOrchestratorPort } from "../ports/ai-content-orchestrator.port.js";
import { AIContentQualityGateService } from "../services/ai-content-quality-gate.service.js";
import type { GenerateBlogContentUseCase } from "./generate-blog-content.use-case.js";
import type { GenerateEmailContentUseCase } from "./generate-email-content.use-case.js";
import type { GenerateProductContentUseCase } from "./generate-product-content.use-case.js";
import type { GenerateSEOContentUseCase } from "./generate-seo-content.use-case.js";
import type { GenerateSocialMediaContentUseCase } from "./generate-social-media-content.use-case.js";
import type { GenerateVideoScriptUseCase } from "./generate-video-script.use-case.js";
import type { LocalizeContentUseCase } from "./localize-content.use-case.js";
import type { ScoreContentQualityUseCase } from "./score-content-quality.use-case.js";

export interface AIContentOrchestratorDependencies {
  readonly productContent: Pick<GenerateProductContentUseCase, "execute">;
  readonly seoContent: Pick<GenerateSEOContentUseCase, "execute">;
  readonly socialContent: Pick<GenerateSocialMediaContentUseCase, "execute">;
  readonly videoContent: Pick<GenerateVideoScriptUseCase, "execute">;
  readonly emailContent: Pick<GenerateEmailContentUseCase, "execute">;
  readonly blogContent: Pick<GenerateBlogContentUseCase, "execute">;
  readonly qualityScoring: Pick<ScoreContentQualityUseCase, "execute">;
  readonly localization: Pick<LocalizeContentUseCase, "execute">;
}

class SystemAIContentOrchestrationClock implements AIContentOrchestrationClock {
  public now(): Date {
    return new Date();
  }
}

interface MutableOutputs {
  product?: ProductContentPackage;
  seo?: SEOContentPackage;
  social: SocialMediaContentPackage[];
  video: VideoScriptPackage[];
  email: EmailContentPackage[];
  blog: BlogContentPackage[];
  scores: ContentQualityScorecard[];
  localized: LocalizedContentPackage[];
}

export class OrchestrateAIContentUseCase implements AIContentOrchestratorPort {
  public constructor(
    private readonly dependencies: AIContentOrchestratorDependencies,
    private readonly optionsFactory = new AIContentOrchestrationOptionsFactory(),
    private readonly planFactory = new AIContentExecutionPlanFactory(),
    private readonly mapper = new AIContentOrchestrationMapper(),
    private readonly qualityGateService = new AIContentQualityGateService(),
    private readonly clock: AIContentOrchestrationClock = new SystemAIContentOrchestrationClock(),
  ) {}

  public orchestrate(
    input: AIContentOrchestrationInput,
    optionsInput: AIContentOrchestrationOptionsInput = {},
  ): AIContentPortfolio {
    const orchestrationStartedAt = this.clock.now();
    const options = this.optionsFactory.create(input, optionsInput);
    const plan = this.planFactory.create(options);
    const results: AIContentStageResult[] = [];
    const outputs: MutableOutputs = {
      social: [],
      video: [],
      email: [],
      blog: [],
      scores: [],
      localized: [],
    };

    this.recordCompleted(plan.stages[0]!, input, results, [input.product.product.id]);
    this.generateProduct(input, options, plan.stages, results, outputs);
    this.generateSEO(input, options, plan.stages, results, outputs);
    this.generateSocial(input, options, plan.stages, results, outputs);
    this.generateVideo(input, options, plan.stages, results, outputs);
    this.generateEmail(input, options, plan.stages, results, outputs);
    this.generateBlog(input, options, plan.stages, results, outputs);
    this.scoreContent(input, options, plan.stages, results, outputs);
    const gate = this.applyQualityGate(input, options, plan.stages, results, outputs);
    const sourceContents = this.collectSourceContents(outputs);
    this.localize(input, options, plan.stages, results, outputs, sourceContents, gate);
    this.recordCompleted(
      this.stage(plan.stages, "portfolio-assembly"),
      input,
      results,
      sourceContents.map((item) => item.id),
    );
    const orchestratedAt = this.clock.now();
    return this.buildPortfolio(
      input,
      options,
      results,
      outputs,
      sourceContents,
      gate,
      orchestrationStartedAt,
      orchestratedAt,
    );
  }

  private generateProduct(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): void {
    const stage = this.optionalStage(stages, "product-content");
    if (stage === undefined) return;
    const generated = this.execute(
      stage,
      input,
      options,
      results,
      () =>
        this.dependencies.productContent.execute({
          input: this.mapper.productInput(input),
          options: {
            ...input.productContentOptions,
            ...(options.contentTone === undefined ? {} : { tone: options.contentTone }),
            strictClaimSafety: options.strictSafetyMode,
          },
        }),
      (value) => value.contents.map((item) => item.id),
    );
    if (generated !== undefined) outputs.product = generated;
  }

  private generateSEO(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): void {
    const stage = this.optionalStage(stages, "seo-content");
    if (stage === undefined) return;
    if (outputs.product === undefined)
      return this.recordBlocked(stage, input, results, "Product content was unavailable.");
    const product = outputs.product;
    const generated = this.execute(
      stage,
      input,
      options,
      results,
      () =>
        this.dependencies.seoContent.execute({
          input: this.mapper.seoInput(input, product),
          options: {
            ...input.seoOptions,
            strictClaimSafety: options.strictSafetyMode,
            strictKeywordSafety: options.strictSafetyMode,
          },
        }),
      (value) => value.contents.map((item) => item.id),
    );
    if (generated !== undefined) outputs.seo = generated;
  }

  private generateSocial(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): void {
    const stage = this.optionalStage(stages, "social-content");
    if (stage === undefined) return;
    if (outputs.product === undefined)
      return this.recordBlocked(stage, input, results, "Product content was unavailable.");
    const product = outputs.product;
    this.executeCollection(
      stage,
      input,
      options,
      results,
      options.selectedSocialPlatforms,
      (platform) =>
        this.dependencies.socialContent.execute({
          input: this.mapper.socialInput(input, product, outputs.seo),
          options: {
            ...input.socialOptions,
            platform,
            strictClaimSafety: options.strictSafetyMode,
          },
        }),
      outputs.social,
    );
  }

  private generateVideo(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): void {
    const stage = this.optionalStage(stages, "video-content");
    if (stage === undefined) return;
    if (outputs.product === undefined)
      return this.recordBlocked(stage, input, results, "Product content was unavailable.");
    const product = outputs.product;
    this.executeCollection(
      stage,
      input,
      options,
      results,
      options.selectedVideoConfigurations,
      (selection) =>
        this.dependencies.videoContent.execute({
          input: this.mapper.videoInput(input, product, outputs.seo, outputs.social[0]),
          options: {
            ...input.videoOptions,
            ...selection,
            strictClaimSafety: options.strictSafetyMode,
          },
        }),
      outputs.video,
    );
  }

  private generateEmail(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): void {
    const stage = this.optionalStage(stages, "email-content");
    if (stage === undefined) return;
    if (outputs.product === undefined)
      return this.recordBlocked(stage, input, results, "Product content was unavailable.");
    const product = outputs.product;
    this.executeCollection(
      stage,
      input,
      options,
      results,
      options.selectedEmailCampaignTypes,
      (campaignType) =>
        this.dependencies.emailContent.execute({
          input: this.mapper.emailInput(
            input,
            product,
            outputs.seo,
            outputs.social[0],
            outputs.video[0],
          ),
          options: {
            ...input.emailOptions,
            campaignType,
            strictClaimSafety: options.strictSafetyMode,
          },
        }),
      outputs.email,
    );
  }

  private generateBlog(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): void {
    const stage = this.optionalStage(stages, "blog-content");
    if (stage === undefined) return;
    if (outputs.product === undefined)
      return this.recordBlocked(stage, input, results, "Product content was unavailable.");
    const product = outputs.product;
    this.executeCollection(
      stage,
      input,
      options,
      results,
      options.selectedBlogArticleTypes,
      (articleType) =>
        this.dependencies.blogContent.execute({
          input: this.mapper.blogInput(
            input,
            product,
            outputs.seo,
            outputs.social[0],
            outputs.video[0],
            outputs.email[0],
          ),
          options: {
            ...input.blogOptions,
            articleType,
            strictClaimSafetyMode: options.strictSafetyMode,
          },
        }),
      outputs.blog,
    );
  }

  private scoreContent(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): void {
    const stage = this.optionalStage(stages, "quality-scoring");
    if (stage === undefined) return;
    const candidates = this.mapper.scoringCandidates(
      outputs.product,
      outputs.seo,
      outputs.social,
      outputs.video,
      outputs.email,
      outputs.blog,
    );
    this.executeCollection(
      stage,
      input,
      options,
      results,
      candidates,
      (candidate) =>
        this.dependencies.qualityScoring.execute({
          input: candidate.input,
          options: {
            scoringProfile:
              options.qualityProfiles[candidate.stageId] ?? scoringProfileFor(candidate.stageId),
            strictSafetyMode: options.strictSafetyMode,
            minimumApprovalScore: options.minimumApprovalScore,
            minimumPublishScore: options.minimumPublicationScore,
          },
        }),
      outputs.scores,
    );
  }

  private applyQualityGate(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
  ): AIContentQualityGateResult {
    const stage = this.optionalStage(stages, "quality-gate");
    if (stage === undefined) return emptyGate();
    return (
      this.execute(
        stage,
        input,
        options,
        results,
        () => this.qualityGateService.evaluate(outputs.scores, options),
        () => ["quality-gate"],
      ) ?? emptyGate()
    );
  }

  private localize(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    stages: readonly AIContentExecutionStage[],
    results: AIContentStageResult[],
    outputs: MutableOutputs,
    contents: readonly Content[],
    gate: AIContentQualityGateResult,
  ): void {
    const stage = this.optionalStage(stages, "localization");
    if (stage === undefined) return;
    if (options.qualityGatePolicy === "strict" && gate.status === "failed") {
      return this.recordBlocked(stage, input, results, "Strict quality gate blocked localization.");
    }
    const localizationInputs = this.mapper.localizationInputs(contents, options.targetLocales);
    this.executeCollection(
      stage,
      input,
      options,
      results,
      localizationInputs,
      (localizationInput) =>
        this.dependencies.localization.execute({
          input: localizationInput,
          options: {
            ...(input.sourceLocale === undefined ? {} : { sourceLocale: input.sourceLocale }),
            targetLocale: localizationInput.targetLocale,
            localizationMode:
              localizationInput.sourceLanguage === localizationInput.targetLanguage
                ? "adapt"
                : "translate-and-adapt",
            strictClaimPreservationMode: options.strictSafetyMode,
          },
        }),
      outputs.localized,
    );
  }

  private execute<T>(
    stage: AIContentExecutionStage,
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    results: AIContentStageResult[],
    action: () => T,
    references: (value: T) => readonly string[],
  ): T | undefined {
    const startedAt = this.clock.now();
    try {
      const value = action();
      this.record(stage, input, results, startedAt, "completed", references(value), [], []);
      return value;
    } catch (error: unknown) {
      const issue = issueFrom(stage.id, error);
      this.record(stage, input, results, startedAt, "failed", [], [], [issue]);
      if (options.failurePolicy === "fail-fast") {
        throw new AIContentStageExecutionError(`${stage.name} failed: ${issue.message}`, {
          stageId: stage.id,
          causeCode: issue.code,
        });
      }
      return undefined;
    }
  }

  private executeCollection<TItem, TOutput>(
    stage: AIContentExecutionStage,
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    results: AIContentStageResult[],
    items: readonly TItem[],
    action: (item: TItem) => TOutput,
    target: TOutput[],
  ): void {
    const startedAt = this.clock.now();
    const errors: AIContentStageIssue[] = [];
    for (const item of items) {
      try {
        target.push(action(item));
      } catch (error: unknown) {
        const issue = issueFrom(stage.id, error);
        errors.push(issue);
        if (options.failurePolicy === "fail-fast") {
          this.record(
            stage,
            input,
            results,
            startedAt,
            "failed",
            target.map(referenceFor),
            [],
            errors,
          );
          throw new AIContentStageExecutionError(`${stage.name} failed: ${issue.message}`, {
            stageId: stage.id,
            causeCode: issue.code,
          });
        }
      }
    }
    const status =
      errors.length === 0 ? "completed" : target.length > 0 ? "completed-with-warnings" : "failed";
    this.record(
      stage,
      input,
      results,
      startedAt,
      status,
      target.map(referenceFor),
      errors.map((error) => error.message),
      errors,
    );
  }

  private collectSourceContents(outputs: MutableOutputs): readonly Content[] {
    return this.mapper.collectContents([
      ...(outputs.product === undefined ? [] : [outputs.product]),
      ...(outputs.seo === undefined ? [] : [outputs.seo]),
      ...outputs.social,
      ...outputs.video,
      ...outputs.email,
      ...outputs.blog,
    ]);
  }

  private buildPortfolio(
    input: AIContentOrchestrationInput,
    options: AIContentOrchestrationOptions,
    results: readonly AIContentStageResult[],
    outputs: MutableOutputs,
    sourceContents: readonly Content[],
    gate: AIContentQualityGateResult,
    startedAt: Date,
    orchestratedAt: Date,
  ): AIContentPortfolio {
    const localizedContents = outputs.localized.flatMap((item) => item.contents);
    const contents = this.mapper.collectContents([
      { contents: sourceContents },
      { contents: localizedContents },
    ]);
    const errors = results.flatMap((result) => result.errors);
    const warnings = results.flatMap((result) => result.warnings);
    const localizationSummary = localizationSummaryFor(options.targetLocales, outputs.localized);
    const readiness = readinessFor(results, gate, localizationSummary);
    const auditTrail = options.includeAuditTrail ? auditFor(results) : [];
    const executionMetrics = options.includeExecutionMetrics
      ? metricsFor(
          results,
          contents.length,
          outputs.localized.length,
          gate,
          startedAt,
          orchestratedAt,
        )
      : undefined;
    return {
      productId: input.product.product.id,
      ...(options.includeRawIntermediatePackages && outputs.product !== undefined
        ? { productContentPackage: outputs.product }
        : {}),
      ...(options.includeRawIntermediatePackages && outputs.seo !== undefined
        ? { seoContentPackage: outputs.seo }
        : {}),
      socialContentPackages: options.includeRawIntermediatePackages ? outputs.social : [],
      videoScriptPackages: options.includeRawIntermediatePackages ? outputs.video : [],
      emailContentPackages: options.includeRawIntermediatePackages ? outputs.email : [],
      blogContentPackages: options.includeRawIntermediatePackages ? outputs.blog : [],
      qualityScorecards: outputs.scores,
      localizedContentPackages: options.includeLocalizedPackages ? outputs.localized : [],
      contents,
      stageResults: results,
      qualityGate: gate,
      localizationSummary,
      readiness,
      approvalReady: readiness === "ready-for-approval" || readiness === "ready-for-publication",
      publicationReady: readiness === "ready-for-publication",
      warnings,
      errors,
      skippedStages: results.filter(
        (result) => result.status === "skipped" || result.status === "blocked",
      ),
      auditTrail,
      ...(executionMetrics === undefined ? {} : { executionMetrics }),
      portfolioMetadata: { ...(input.customMetadata ?? {}), stageCount: results.length },
      sourceReferences: [input.product.product.id],
      campaignReferences: input.campaignId === undefined ? [] : [input.campaignId],
      correlationId: input.correlationId,
      orchestrationVersion: "SACP AI Content Orchestrator v1",
      orchestratedAt,
    };
  }

  private recordCompleted(
    stage: AIContentExecutionStage,
    input: AIContentOrchestrationInput,
    results: AIContentStageResult[],
    outputReferences: readonly string[],
  ): void {
    const startedAt = this.clock.now();
    this.record(stage, input, results, startedAt, "completed", outputReferences, [], []);
  }

  private recordBlocked(
    stage: AIContentExecutionStage,
    input: AIContentOrchestrationInput,
    results: AIContentStageResult[],
    reason: string,
  ): void {
    const startedAt = this.clock.now();
    this.record(stage, input, results, startedAt, "blocked", [], [reason], [], reason);
  }

  private record(
    stage: AIContentExecutionStage,
    input: AIContentOrchestrationInput,
    results: AIContentStageResult[],
    startedAt: Date,
    status: AIContentStageResult["status"],
    outputReferences: readonly string[],
    warnings: readonly string[],
    errors: readonly AIContentStageIssue[],
    skippedReason?: string,
  ): void {
    const completedAt = this.clock.now();
    results.push({
      stageId: stage.id,
      stageName: stage.name,
      status,
      startedAt,
      completedAt,
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      inputReference: input.product.product.id,
      outputReferences,
      warnings,
      errors,
      retryable: status === "failed",
      ...(skippedReason === undefined ? {} : { skippedReason }),
      dependencies: stage.dependencies,
      criticality: stage.criticality,
      correlationId: input.correlationId,
    });
  }

  private stage(
    stages: readonly AIContentExecutionStage[],
    id: AIContentExecutionStage["id"],
  ): AIContentExecutionStage {
    const stage = stages.find((candidate) => candidate.id === id);
    if (stage === undefined)
      throw new AIContentStageExecutionError(`Execution plan omitted required stage ${id}.`);
    return stage;
  }

  private optionalStage(
    stages: readonly AIContentExecutionStage[],
    id: AIContentExecutionStage["id"],
  ): AIContentExecutionStage | undefined {
    return stages.find((candidate) => candidate.id === id);
  }
}

function referenceFor(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    if ("contentId" in value && typeof value.contentId === "string") return value.contentId;
    if (
      "sourceMetadata" in value &&
      typeof value.sourceMetadata === "object" &&
      value.sourceMetadata !== null &&
      "productId" in value.sourceMetadata &&
      typeof value.sourceMetadata.productId === "string"
    )
      return value.sourceMetadata.productId;
    if ("productId" in value && typeof value.productId === "string") return value.productId;
  }
  return "generated-output";
}

function issueFrom(stageId: AIContentStageIssue["stageId"], error: unknown): AIContentStageIssue {
  const message = error instanceof Error ? error.message : "Unknown stage execution failure.";
  let code = "AI_CONTENT_STAGE_FAILED";
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  )
    code = error.code;
  return { stageId, code, message, critical: true };
}

function emptyGate(): AIContentQualityGateResult {
  return {
    status: "passed",
    blockingReasons: [],
    affectedPackageIds: [],
    requiredRevisions: [],
    approvalReady: true,
    publicationReady: false,
    averageScore: 0,
    warningCount: 0,
    criticalIssueCount: 0,
  };
}

function scoringProfileFor(
  stageId: AIContentStageIssue["stageId"],
): ContentQualityScorecard["scoringProfile"] {
  const profiles: Partial<
    Record<AIContentStageIssue["stageId"], ContentQualityScorecard["scoringProfile"]>
  > = {
    "product-content": "conversion-focused",
    "seo-content": "seo-focused",
    "social-content": "social-engagement-focused",
    "video-content": "video-performance-readiness",
    "email-content": "email-conversion-focused",
    "blog-content": "editorial-quality-focused",
  };
  return profiles[stageId] ?? "balanced";
}

function localizationSummaryFor(
  targets: readonly AIContentLocalizationSummary["requestedLocales"][number][],
  packages: readonly LocalizedContentPackage[],
): AIContentLocalizationSummary {
  return {
    requestedLocales: targets,
    completedLocales: [...new Set(packages.map((item) => item.targetLocale))],
    localizedPackageCount: packages.length,
    reviewRequiredCount: packages.filter(
      (item) => item.readiness === "review-required" || item.readiness === "not-localizable",
    ).length,
    warningCount: packages.reduce((total, item) => total + item.warnings.length, 0),
  };
}

function readinessFor(
  results: readonly AIContentStageResult[],
  gate: AIContentQualityGateResult,
  localization: AIContentLocalizationSummary,
): AIContentPortfolioReadiness {
  if (
    results.some(
      (result) =>
        result.criticality === "required" &&
        (result.status === "failed" || result.status === "blocked"),
    )
  )
    return "failed";
  if (
    results.some(
      (result) =>
        result.status === "failed" ||
        result.status === "blocked" ||
        result.status === "completed-with-warnings" ||
        result.errors.length > 0,
    )
  )
    return "partial";
  if (gate.status === "failed" || localization.reviewRequiredCount > 0) return "needs-revision";
  if (gate.publicationReady) return "ready-for-publication";
  if (gate.approvalReady) return "ready-for-approval";
  return "ready-for-review";
}

function auditFor(results: readonly AIContentStageResult[]): readonly AIContentAuditRecord[] {
  return results.map((result, index) => ({
    sequence: index + 1,
    stageId: result.stageId,
    action: `Execute ${result.stageName}`,
    status: result.status,
    timestamp: result.completedAt,
    inputReference: result.inputReference,
    outputReferences: result.outputReferences,
    warningCount: result.warnings.length,
    errorCount: result.errors.length,
    correlationId: result.correlationId,
    message: `${result.stageName} ${result.status}.`,
  }));
}

function metricsFor(
  results: readonly AIContentStageResult[],
  generatedContentCount: number,
  localizedContentCount: number,
  gate: AIContentQualityGateResult,
  startedAt: Date,
  completedAt: Date,
): AIContentExecutionMetrics {
  return {
    stageCount: results.length,
    completedStageCount: results.filter(
      (result) => result.status === "completed" || result.status === "completed-with-warnings",
    ).length,
    failedStageCount: results.filter((result) => result.status === "failed").length,
    skippedStageCount: results.filter(
      (result) => result.status === "skipped" || result.status === "blocked",
    ).length,
    warningCount: results.reduce((total, result) => total + result.warnings.length, 0),
    criticalIssueCount: gate.criticalIssueCount,
    generatedContentCount,
    localizedContentCount,
    averageQualityScore: gate.averageScore,
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
  };
}
