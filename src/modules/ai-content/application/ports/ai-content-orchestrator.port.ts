import type {
  AIContentOrchestrationInput,
  AIContentOrchestrationOptionsInput,
  AIContentPortfolio,
} from "../dto/ai-content-orchestration.types.js";

export interface AIContentOrchestratorPort {
  orchestrate(
    input: AIContentOrchestrationInput,
    options?: AIContentOrchestrationOptionsInput,
  ): AIContentPortfolio;
}
