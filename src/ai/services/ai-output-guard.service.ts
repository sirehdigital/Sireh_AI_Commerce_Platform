import { InvalidAIFallbackPolicyError } from "../safety/ai-output-safety.errors.js";
import type {
  AIDeterministicFallbackPolicy,
  AISafetyDecisionPolicy,
  AIOutputValidationPolicy,
  GuardedAIOutputResult,
} from "../types/ai-output-safety.types.js";
import type { AITextGenerationResponse } from "../types/ai-provider.types.js";
import { AISafetyEvaluationService } from "./ai-safety-evaluation.service.js";
import { AIOutputValidationService } from "./ai-output-validation.service.js";

export class AIOutputGuardService {
  public constructor(
    private readonly validationService: AIOutputValidationService,
    private readonly safetyEvaluationService: AISafetyEvaluationService,
  ) {}

  public guard(
    response: AITextGenerationResponse,
    validationPolicy: AIOutputValidationPolicy,
    safetyPolicy: AISafetyDecisionPolicy,
    fallbackPolicy: AIDeterministicFallbackPolicy,
  ): GuardedAIOutputResult {
    const fallbackContent = this.validateFallbackPolicy(fallbackPolicy);
    const validation = this.validationService.validate(response, validationPolicy);
    const safety = this.safetyEvaluationService.evaluate(validation, safetyPolicy);

    if (safety.decision === "reject") {
      return Object.freeze({
        policyId: validationPolicy.id,
        policyVersion: validationPolicy.version,
        safetyDecision: safety.decision,
        content: fallbackContent,
        usedFallback: true,
        validation,
        fallbackPolicyId: fallbackPolicy.id,
        fallbackPolicyVersion: fallbackPolicy.version,
      });
    }

    return Object.freeze({
      policyId: validationPolicy.id,
      policyVersion: validationPolicy.version,
      safetyDecision: safety.decision,
      content: validation.normalizedContent,
      usedFallback: false,
      validation,
    });
  }

  private validateFallbackPolicy(policy: AIDeterministicFallbackPolicy): string {
    if (policy.id.trim().length === 0) {
      throw new InvalidAIFallbackPolicyError("AI fallback policy ID must not be empty.");
    }

    if (policy.version.trim().length === 0) {
      throw new InvalidAIFallbackPolicyError("AI fallback policy version must not be empty.", policy.id);
    }

    const normalizedContent = policy.fallbackContent.trim();

    if (normalizedContent.length === 0) {
      throw new InvalidAIFallbackPolicyError("AI fallback content must not be empty.", policy.id);
    }

    return normalizedContent;
  }
}
