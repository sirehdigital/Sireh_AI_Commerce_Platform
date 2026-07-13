import type {
  AIContentExecutionPlan,
  AIContentExecutionStage,
  AIContentOrchestrationOptions,
  AIContentStageId,
} from "../dto/ai-content-orchestration.types.js";
import {
  InvalidAIContentExecutionPlanError,
  MissingAIContentDependencyError,
} from "../errors/ai-content-orchestration.errors.js";

const ORDER: readonly AIContentStageId[] = [
  "input-validation",
  "product-content",
  "seo-content",
  "social-content",
  "video-content",
  "email-content",
  "blog-content",
  "quality-scoring",
  "quality-gate",
  "localization",
  "portfolio-assembly",
];

const NAMES: Readonly<Record<AIContentStageId, string>> = {
  "input-validation": "Input validation",
  "product-content": "Product content",
  "seo-content": "SEO content",
  "social-content": "Social content",
  "video-content": "Video content",
  "email-content": "Email content",
  "blog-content": "Blog content",
  "quality-scoring": "Quality scoring",
  "quality-gate": "Quality gate",
  localization: "Localization",
  "portfolio-assembly": "Portfolio assembly",
};

export class AIContentExecutionPlanFactory {
  public create(options: AIContentOrchestrationOptions): AIContentExecutionPlan {
    const requested = [...options.enabledStages];
    const enabled = new Set(requested);
    const dependencies = this.dependencies(enabled);
    const requiredDependencies = new Set<AIContentStageId>();
    for (const stage of requested) {
      for (const dependency of dependencies[stage]) {
        requiredDependencies.add(dependency);
        if (!enabled.has(dependency)) {
          throw new MissingAIContentDependencyError(
            `${stage} requires enabled stage ${dependency}.`,
            { stage, dependency },
          );
        }
      }
    }

    const stages = ORDER.filter((stage) => enabled.has(stage)).map(
      (stage, index): AIContentExecutionStage => ({
        id: stage,
        name: NAMES[stage],
        order: index + 1,
        dependencies: dependencies[stage],
        criticality:
          stage === "input-validation" ||
          stage === "product-content" ||
          stage === "portfolio-assembly"
            ? "required"
            : "optional",
        parallelizable:
          stage === "social-content" ||
          stage === "video-content" ||
          stage === "email-content" ||
          stage === "blog-content",
        expectedOutput: outputFor(stage),
      }),
    );
    this.assertAcyclic(stages);

    return {
      stages,
      requestedStages: requested,
      requiredDependencyStages: ORDER.filter((stage) => requiredDependencies.has(stage)),
      failurePolicy: options.failurePolicy,
      qualityGatePolicy: options.qualityGatePolicy,
      localizationTargets: options.targetLocales,
    };
  }

  private dependencies(
    enabled: ReadonlySet<AIContentStageId>,
  ): Readonly<Record<AIContentStageId, readonly AIContentStageId[]>> {
    return {
      "input-validation": [],
      "product-content": ["input-validation"],
      "seo-content": ["product-content"],
      "social-content": ["product-content"],
      "video-content": ["product-content"],
      "email-content": ["product-content"],
      "blog-content": ["product-content"],
      "quality-scoring": ["product-content"],
      "quality-gate": ["quality-scoring"],
      localization: enabled.has("quality-gate") ? ["quality-gate"] : ["product-content"],
      "portfolio-assembly": ["input-validation"],
    };
  }

  private assertAcyclic(stages: readonly AIContentExecutionStage[]): void {
    const seen = new Set<AIContentStageId>();
    for (const stage of stages) {
      if (stage.dependencies.some((dependency) => !seen.has(dependency))) {
        throw new InvalidAIContentExecutionPlanError(
          `Invalid stage order or cycle detected at ${stage.id}.`,
        );
      }
      seen.add(stage.id);
    }
  }
}

function outputFor(stage: AIContentStageId): string {
  if (stage === "quality-gate") return "AIContentQualityGateResult";
  if (stage === "portfolio-assembly") return "AIContentPortfolio";
  if (stage === "input-validation") return "Validated orchestration input";
  return `${stage} package collection`;
}
