import {
  DuplicateAIExecutionTargetError,
  InvalidAIExecutionContextError,
  InvalidAIExecutionPolicyError,
} from "../policies/ai-execution-policy.errors.js";
import type {
  AIExecutionContext,
  AIExecutionPlan,
  AIExecutionPolicy,
  AIExecutionTarget,
  AIGenerationControls,
  AIRetryPolicy,
  AIRetryableFailureCategory,
} from "../types/ai-execution-policy.types.js";
import type { AIMetadata } from "../types/ai-provider.types.js";

const MAX_TIMEOUT_MS = 300_000;
const MAX_ATTEMPTS = 5;
const RETRYABLE_FAILURE_CATEGORIES: readonly AIRetryableFailureCategory[] = [
  "timeout",
  "rate_limit",
  "provider_unavailable",
  "temporary_failure",
];

export class AIExecutionPolicyService {
  public createPlan(policy: AIExecutionPolicy, context: AIExecutionContext): AIExecutionPlan {
    this.validatePolicy(policy);
    this.validateContext(context);

    const primaryTarget = this.resolvePrimaryTarget(policy.primaryTarget, context);
    const fallbackTargets = context.allowFallback
      ? this.resolveFallbackTargets(policy.fallbackTargets, primaryTarget)
      : [];

    return {
      policyId: policy.id,
      policyVersion: policy.version,
      primaryTarget: this.copyTarget(primaryTarget),
      fallbackTargets: Object.freeze(fallbackTargets.map((target) => this.copyTarget(target))),
      generationControls: this.copyGenerationControls(policy.generationControls),
      timeoutMs: policy.timeoutPolicy.timeoutMs,
      maxAttempts: policy.retryPolicy.maxAttempts,
      retryableFailureCategories: Object.freeze([...policy.retryPolicy.retryableFailureCategories]),
      metadata: this.copyMetadata(context.metadata),
    };
  }

  private validatePolicy(policy: AIExecutionPolicy): void {
    if (policy.id.trim().length === 0) {
      throw new InvalidAIExecutionPolicyError("AI execution policy ID must not be empty.");
    }

    if (policy.version.trim().length === 0) {
      throw new InvalidAIExecutionPolicyError(
        "AI execution policy version must not be empty.",
        policy.id,
      );
    }

    this.validateTarget(policy.primaryTarget, policy.id);

    for (const target of policy.fallbackTargets) {
      this.validateTarget(target, policy.id);
    }

    this.validateDuplicateTargets(policy);
    this.validateGenerationControls(policy.generationControls, policy.id);
    this.validateTimeout(policy.timeoutPolicy.timeoutMs, policy.id);
    this.validateRetryPolicy(policy.retryPolicy, policy.id);
  }

  private validateTarget(target: AIExecutionTarget, policyId: string): void {
    if (target.providerId.trim().length === 0) {
      throw new InvalidAIExecutionPolicyError("AI execution target provider ID must not be empty.", policyId);
    }

    if (target.model.trim().length === 0) {
      throw new InvalidAIExecutionPolicyError("AI execution target model ID must not be empty.", policyId);
    }
  }

  private validateDuplicateTargets(policy: AIExecutionPolicy): void {
    const primaryKey = this.targetKey(policy.primaryTarget);
    const seenFallbacks = new Set<string>();

    for (const target of policy.fallbackTargets) {
      const key = this.targetKey(target);

      if (key === primaryKey || seenFallbacks.has(key)) {
        throw new DuplicateAIExecutionTargetError(target, policy.id);
      }

      seenFallbacks.add(key);
    }
  }

  private validateGenerationControls(controls: AIGenerationControls, policyId: string): void {
    if (
      controls.temperature !== undefined &&
      (!Number.isFinite(controls.temperature) || controls.temperature < 0 || controls.temperature > 2)
    ) {
      throw new InvalidAIExecutionPolicyError(
        "AI execution temperature must be a finite number between 0 and 2.",
        policyId,
      );
    }

    if (
      controls.maxOutputTokens !== undefined &&
      (!Number.isSafeInteger(controls.maxOutputTokens) || controls.maxOutputTokens <= 0)
    ) {
      throw new InvalidAIExecutionPolicyError(
        "AI execution max output tokens must be a positive safe integer.",
        policyId,
      );
    }
  }

  private validateTimeout(timeoutMs: number, policyId: string): void {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new InvalidAIExecutionPolicyError(
        `AI execution timeout must be a positive safe integer no greater than ${MAX_TIMEOUT_MS}.`,
        policyId,
      );
    }
  }

  private validateRetryPolicy(retryPolicy: AIRetryPolicy, policyId: string): void {
    if (
      !Number.isSafeInteger(retryPolicy.maxAttempts) ||
      retryPolicy.maxAttempts < 1 ||
      retryPolicy.maxAttempts > MAX_ATTEMPTS
    ) {
      throw new InvalidAIExecutionPolicyError(
        `AI execution max attempts must be a safe integer between 1 and ${MAX_ATTEMPTS}.`,
        policyId,
      );
    }

    const seenCategories = new Set<AIRetryableFailureCategory>();

    for (const category of retryPolicy.retryableFailureCategories) {
      if (!RETRYABLE_FAILURE_CATEGORIES.includes(category)) {
        throw new InvalidAIExecutionPolicyError(
          `AI execution retry category "${category}" is invalid.`,
          policyId,
        );
      }

      if (seenCategories.has(category)) {
        throw new InvalidAIExecutionPolicyError(
          `AI execution retry category "${category}" is duplicated.`,
          policyId,
        );
      }

      seenCategories.add(category);
    }
  }

  private validateContext(context: AIExecutionContext): void {
    const hasProviderOverride = context.requestedProviderId !== undefined;
    const hasModelOverride = context.requestedModel !== undefined;

    if (context.requestedProviderId?.trim().length === 0) {
      throw new InvalidAIExecutionContextError("Requested provider ID must not be empty.");
    }

    if (context.requestedModel?.trim().length === 0) {
      throw new InvalidAIExecutionContextError("Requested model ID must not be empty.");
    }

    if (hasProviderOverride && !hasModelOverride) {
      throw new InvalidAIExecutionContextError(
        "Requested provider override requires an explicit requested model.",
      );
    }
  }

  private resolvePrimaryTarget(
    policyPrimaryTarget: AIExecutionTarget,
    context: AIExecutionContext,
  ): AIExecutionTarget {
    if (context.requestedProviderId !== undefined && context.requestedModel !== undefined) {
      return {
        providerId: context.requestedProviderId,
        model: context.requestedModel,
      };
    }

    if (context.requestedModel !== undefined) {
      return {
        providerId: policyPrimaryTarget.providerId,
        model: context.requestedModel,
      };
    }

    return policyPrimaryTarget;
  }

  private resolveFallbackTargets(
    fallbackTargets: readonly AIExecutionTarget[],
    primaryTarget: AIExecutionTarget,
  ): readonly AIExecutionTarget[] {
    const primaryKey = this.targetKey(primaryTarget);

    return fallbackTargets.filter((target) => this.targetKey(target) !== primaryKey);
  }

  private copyTarget(target: AIExecutionTarget): AIExecutionTarget {
    return {
      providerId: target.providerId,
      model: target.model,
    };
  }

  private copyGenerationControls(controls: AIGenerationControls): AIGenerationControls {
    return {
      ...(controls.temperature === undefined ? {} : { temperature: controls.temperature }),
      ...(controls.maxOutputTokens === undefined ? {} : { maxOutputTokens: controls.maxOutputTokens }),
    };
  }

  private copyMetadata(metadata: AIMetadata | undefined): AIMetadata {
    return Object.freeze({ ...(metadata ?? {}) });
  }

  private targetKey(target: AIExecutionTarget): string {
    return `${target.providerId.trim().toLowerCase()}\u0000${target.model.trim().toLowerCase()}`;
  }
}
