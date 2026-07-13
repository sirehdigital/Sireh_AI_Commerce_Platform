import {
  DeterministicBlogContentGenerator,
  DeterministicContentLocalizationEngine,
  DeterministicContentQualityScoringEngine,
  DeterministicEmailContentGenerator,
  DeterministicProductContentGenerator,
  DeterministicSEOContentGenerator,
  DeterministicSocialMediaContentGenerator,
  DeterministicVideoScriptGenerator,
  GenerateBlogContentUseCase,
  GenerateEmailContentUseCase,
  GenerateProductContentUseCase,
  GenerateSEOContentUseCase,
  GenerateSocialMediaContentUseCase,
  GenerateVideoScriptUseCase,
  LocalizeContentUseCase,
  OrchestrateAIContentUseCase,
  ScoreContentQualityUseCase,
  type AIContentOrchestrationClock,
  type AIContentOrchestratorDependencies,
} from "../../index.js";

export class IntegrationTestClock implements AIContentOrchestrationClock {
  public now(): Date {
    return new Date("2026-07-13T00:00:00.000Z");
  }
}

export function createIntegrationDependencies(): AIContentOrchestratorDependencies {
  return {
    productContent: new GenerateProductContentUseCase(new DeterministicProductContentGenerator()),
    seoContent: new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator()),
    socialContent: new GenerateSocialMediaContentUseCase(
      new DeterministicSocialMediaContentGenerator(),
    ),
    videoContent: new GenerateVideoScriptUseCase(new DeterministicVideoScriptGenerator()),
    emailContent: new GenerateEmailContentUseCase(new DeterministicEmailContentGenerator()),
    blogContent: new GenerateBlogContentUseCase(new DeterministicBlogContentGenerator()),
    qualityScoring: new ScoreContentQualityUseCase(new DeterministicContentQualityScoringEngine()),
    localization: new LocalizeContentUseCase(new DeterministicContentLocalizationEngine()),
  };
}

export function createAIContentIntegrationHarness(
  overrides: Partial<AIContentOrchestratorDependencies> = {},
): OrchestrateAIContentUseCase {
  return new OrchestrateAIContentUseCase(
    { ...createIntegrationDependencies(), ...overrides },
    undefined,
    undefined,
    undefined,
    undefined,
    new IntegrationTestClock(),
  );
}
