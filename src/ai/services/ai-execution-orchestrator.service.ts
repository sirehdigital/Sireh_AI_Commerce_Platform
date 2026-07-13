import {
  AIExecutionConfigurationError,
  AIExecutionExhaustedError,
  AITerminalExecutionError,
} from "../orchestration/ai-execution-orchestrator.errors.js";
import {
  AIProviderExecutionError,
  UnknownAIProviderError,
  type AIProviderFailureCategory,
} from "../providers/ai-provider.errors.js";
import type { AIProviderPort } from "../providers/ai-provider.port.js";
import type { AIExecutionPlan, AIExecutionTarget } from "../types/ai-execution-policy.types.js";
import type {
  AIExecutionAttempt,
  AIExecutionFailedAttempt,
  AIExecutionResult,
} from "../types/ai-execution-orchestrator.types.js";
import type {
  AIMetadata,
  AITextGenerationRequest,
  AITextGenerationResponse,
  AIFinishReason,
} from "../types/ai-provider.types.js";
import type { RenderedPrompt } from "../types/prompt.types.js";
import { AIProviderRegistryService } from "./ai-provider-registry.service.js";

const TERMINAL_FAILURE_CATEGORIES: readonly AIProviderFailureCategory[] = [
  "authentication",
  "permission_denied",
  "invalid_request",
  "content_filtered",
  "cancelled",
];

interface FailureDetails {
  readonly failureCategory: AIProviderFailureCategory;
  readonly providerStatusCode?: number;
  readonly providerRequestId?: string;
}

export class AIExecutionOrchestratorService {
  public constructor(private readonly providerRegistry: AIProviderRegistryService) {}

  public async execute(
    renderedPrompt: RenderedPrompt,
    plan: AIExecutionPlan,
  ): Promise<AIExecutionResult> {
    this.validateInput(renderedPrompt, plan);

    const attempts: AIExecutionAttempt[] = [];
    const targets = this.uniqueTargets([plan.primaryTarget, ...plan.fallbackTargets]);
    let nextAttemptNumber = 1;
    let lastFailureCategory: AIProviderFailureCategory | undefined;

    for (const target of targets) {
      const provider = this.resolveProvider(target, plan, attempts);

      for (let targetAttemptNumber = 1; targetAttemptNumber <= plan.maxAttempts; targetAttemptNumber += 1) {
        const attemptNumber = nextAttemptNumber;
        nextAttemptNumber += 1;

        const request = this.buildRequest(renderedPrompt, plan, target);
        const execution = await this.invokeProvider(provider, request);

        if (execution.success) {
          const responseFailure = this.failureFromFinishReason(execution.response.finishReason);

          if (responseFailure === undefined) {
            const successfulAttempt = this.createSucceededAttempt(attemptNumber, targetAttemptNumber, target);
            attempts.push(successfulAttempt);

            return this.createResult(plan, target, execution.response, attempts, !this.sameTarget(target, plan.primaryTarget));
          }

          const failedAttempt = this.createFailedAttempt(attemptNumber, targetAttemptNumber, target, responseFailure);
          attempts.push(failedAttempt);
          lastFailureCategory = responseFailure.failureCategory;

          this.throwIfTerminal(plan, target, responseFailure, attempts);

          if (this.canRetry(responseFailure.failureCategory, targetAttemptNumber, plan)) {
            continue;
          }

          break;
        }

        const failedAttempt = this.createFailedAttempt(attemptNumber, targetAttemptNumber, target, execution.failure);
        attempts.push(failedAttempt);
        lastFailureCategory = execution.failure.failureCategory;

        this.throwIfTerminal(plan, target, execution.failure, attempts);

        if (this.canRetry(execution.failure.failureCategory, targetAttemptNumber, plan)) {
          continue;
        }

        break;
      }
    }

    throw new AIExecutionExhaustedError({
      policyId: plan.policyId,
      policyVersion: plan.policyVersion,
      attempts,
      ...(lastFailureCategory === undefined ? {} : { lastFailureCategory }),
    });
  }

  private async invokeProvider(
    provider: AIProviderPort,
    request: AITextGenerationRequest,
  ): Promise<
    | { readonly success: true; readonly response: AITextGenerationResponse }
    | { readonly success: false; readonly failure: FailureDetails }
  > {
    try {
      return {
        success: true,
        response: await provider.generateText(request),
      };
    } catch (error) {
      return {
        success: false,
        failure: this.normalizeFailure(error),
      };
    }
  }

  private resolveProvider(
    target: AIExecutionTarget,
    plan: AIExecutionPlan,
    attempts: readonly AIExecutionAttempt[],
  ): AIProviderPort {
    try {
      return this.providerRegistry.resolve(target.providerId);
    } catch (error) {
      if (error instanceof UnknownAIProviderError) {
        throw new AIExecutionConfigurationError("AI execution target references an unknown provider.", {
          policyId: plan.policyId,
          policyVersion: plan.policyVersion,
          target,
          attempts,
        });
      }

      throw new AIExecutionConfigurationError("AI execution provider resolution failed.", {
        policyId: plan.policyId,
        policyVersion: plan.policyVersion,
        target,
        attempts,
      });
    }
  }

  private buildRequest(
    renderedPrompt: RenderedPrompt,
    plan: AIExecutionPlan,
    target: AIExecutionTarget,
  ): AITextGenerationRequest {
    return {
      model: target.model,
      messages: renderedPrompt.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      ...(plan.generationControls.temperature === undefined
        ? {}
        : { temperature: plan.generationControls.temperature }),
      ...(plan.generationControls.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: plan.generationControls.maxOutputTokens }),
      metadata: this.copyMetadata(plan.metadata),
    };
  }

  private normalizeFailure(error: unknown): FailureDetails {
    if (error instanceof AIProviderExecutionError) {
      return {
        failureCategory: error.failureCategory,
        ...(error.providerStatusCode === undefined ? {} : { providerStatusCode: error.providerStatusCode }),
        ...(error.providerRequestId === undefined ? {} : { providerRequestId: error.providerRequestId }),
      };
    }

    return {
      failureCategory: "unknown",
    };
  }

  private failureFromFinishReason(finishReason: AIFinishReason): FailureDetails | undefined {
    switch (finishReason) {
      case "completed":
      case "max_tokens":
      case "unknown":
        return undefined;
      case "content_filtered":
        return { failureCategory: "content_filtered" };
      case "cancelled":
        return { failureCategory: "cancelled" };
      case "error":
        return { failureCategory: "unknown" };
    }
  }

  private canRetry(
    failureCategory: AIProviderFailureCategory,
    targetAttemptNumber: number,
    plan: AIExecutionPlan,
  ): boolean {
    return (
      !this.isTerminal(failureCategory) &&
      targetAttemptNumber < plan.maxAttempts &&
      this.includesRetryCategory(plan.retryableFailureCategories, failureCategory)
    );
  }

  private throwIfTerminal(
    plan: AIExecutionPlan,
    target: AIExecutionTarget,
    failure: FailureDetails,
    attempts: readonly AIExecutionAttempt[],
  ): void {
    if (!this.isTerminal(failure.failureCategory)) {
      return;
    }

    throw new AITerminalExecutionError({
      policyId: plan.policyId,
      policyVersion: plan.policyVersion,
      target,
      failureCategory: failure.failureCategory,
      ...(failure.providerStatusCode === undefined ? {} : { providerStatusCode: failure.providerStatusCode }),
      ...(failure.providerRequestId === undefined ? {} : { providerRequestId: failure.providerRequestId }),
      attempts,
    });
  }

  private validateInput(renderedPrompt: RenderedPrompt, plan: AIExecutionPlan): void {
    if (!Array.isArray(renderedPrompt.messages) || renderedPrompt.messages.length === 0) {
      throw new AIExecutionConfigurationError("Rendered prompt must contain at least one message.", {
        policyId: plan.policyId,
        policyVersion: plan.policyVersion,
      });
    }

    if (plan.policyId.trim().length === 0) {
      throw new AIExecutionConfigurationError("AI execution policy ID must not be empty.", {
        policyVersion: plan.policyVersion,
      });
    }

    if (plan.policyVersion.trim().length === 0) {
      throw new AIExecutionConfigurationError("AI execution policy version must not be empty.", {
        policyId: plan.policyId,
      });
    }

    this.validateTarget(plan.primaryTarget, plan);

    if (!Number.isSafeInteger(plan.maxAttempts) || plan.maxAttempts < 1) {
      throw new AIExecutionConfigurationError("AI execution max attempts must be a positive safe integer.", {
        policyId: plan.policyId,
        policyVersion: plan.policyVersion,
      });
    }

    if (!Array.isArray(plan.retryableFailureCategories)) {
      throw new AIExecutionConfigurationError("AI execution retry categories must be an array.", {
        policyId: plan.policyId,
        policyVersion: plan.policyVersion,
      });
    }

    for (const category of plan.retryableFailureCategories) {
      if (typeof category !== "string" || category.trim().length === 0) {
        throw new AIExecutionConfigurationError("AI execution retry categories must be non-empty strings.", {
          policyId: plan.policyId,
          policyVersion: plan.policyVersion,
        });
      }
    }

    const fallbackTargets: unknown = plan.fallbackTargets;

    if (!Array.isArray(fallbackTargets)) {
      throw new AIExecutionConfigurationError("AI execution fallback targets must be an array.", {
        policyId: plan.policyId,
        policyVersion: plan.policyVersion,
      });
    }

    for (const target of fallbackTargets) {
      if (!this.isExecutionTarget(target)) {
        throw new AIExecutionConfigurationError("AI execution fallback targets must contain usable targets.", {
          policyId: plan.policyId,
          policyVersion: plan.policyVersion,
        });
      }

      this.validateTarget(target, plan);
    }
  }

  private validateTarget(target: AIExecutionTarget, plan: AIExecutionPlan): void {
    if (target.providerId.trim().length === 0) {
      throw new AIExecutionConfigurationError("AI execution target provider ID must not be empty.", {
        policyId: plan.policyId,
        policyVersion: plan.policyVersion,
        target,
      });
    }

    if (target.model.trim().length === 0) {
      throw new AIExecutionConfigurationError("AI execution target model ID must not be empty.", {
        policyId: plan.policyId,
        policyVersion: plan.policyVersion,
        target,
      });
    }
  }

  private createSucceededAttempt(
    attemptNumber: number,
    targetAttemptNumber: number,
    target: AIExecutionTarget,
  ): AIExecutionAttempt {
    return Object.freeze({
      attemptNumber,
      targetAttemptNumber,
      target: this.copyTarget(target),
      status: "succeeded",
    });
  }

  private createFailedAttempt(
    attemptNumber: number,
    targetAttemptNumber: number,
    target: AIExecutionTarget,
    failure: FailureDetails,
  ): AIExecutionFailedAttempt {
    return Object.freeze({
      attemptNumber,
      targetAttemptNumber,
      target: this.copyTarget(target),
      status: "failed",
      failureCategory: failure.failureCategory,
      ...(failure.providerStatusCode === undefined ? {} : { providerStatusCode: failure.providerStatusCode }),
      ...(failure.providerRequestId === undefined ? {} : { providerRequestId: failure.providerRequestId }),
    });
  }

  private createResult(
    plan: AIExecutionPlan,
    selectedTarget: AIExecutionTarget,
    response: AITextGenerationResponse,
    attempts: readonly AIExecutionAttempt[],
    fallbackUsed: boolean,
  ): AIExecutionResult {
    const copiedAttempts = Object.freeze(attempts.map((attempt) => this.copyAttempt(attempt)));

    return Object.freeze({
      policyId: plan.policyId,
      policyVersion: plan.policyVersion,
      selectedTarget: this.copyTarget(selectedTarget),
      response: this.copyResponse(response),
      attempts: copiedAttempts,
      fallbackUsed,
      totalAttempts: copiedAttempts.length,
    });
  }

  private copyAttempt(attempt: AIExecutionAttempt): AIExecutionAttempt {
    if (attempt.status === "succeeded") {
      return this.createSucceededAttempt(attempt.attemptNumber, attempt.targetAttemptNumber, attempt.target);
    }

    return this.createFailedAttempt(attempt.attemptNumber, attempt.targetAttemptNumber, attempt.target, attempt);
  }

  private copyResponse(response: AITextGenerationResponse): AITextGenerationResponse {
    return Object.freeze({
      providerId: response.providerId,
      model: response.model,
      content: response.content,
      finishReason: response.finishReason,
      usage: Object.freeze({
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
      }),
      ...(response.requestId === undefined ? {} : { requestId: response.requestId }),
    });
  }

  private copyTarget(target: AIExecutionTarget): AIExecutionTarget {
    return Object.freeze({
      providerId: target.providerId,
      model: target.model,
    });
  }

  private copyMetadata(metadata: AIMetadata): AIMetadata {
    return Object.freeze({ ...metadata });
  }

  private uniqueTargets(targets: readonly AIExecutionTarget[]): readonly AIExecutionTarget[] {
    const seen = new Set<string>();
    const uniqueTargets: AIExecutionTarget[] = [];

    for (const target of targets) {
      const key = `${target.providerId.trim().toLowerCase()}\u0000${target.model.trim().toLowerCase()}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueTargets.push(this.copyTarget(target));
      }
    }

    return Object.freeze(uniqueTargets);
  }

  private sameTarget(left: AIExecutionTarget, right: AIExecutionTarget): boolean {
    return (
      left.providerId.trim().toLowerCase() === right.providerId.trim().toLowerCase() &&
      left.model.trim().toLowerCase() === right.model.trim().toLowerCase()
    );
  }

  private isTerminal(failureCategory: AIProviderFailureCategory): boolean {
    return TERMINAL_FAILURE_CATEGORIES.includes(failureCategory);
  }

  private includesRetryCategory(
    retryableFailureCategories: readonly string[],
    failureCategory: AIProviderFailureCategory,
  ): boolean {
    return retryableFailureCategories.includes(failureCategory);
  }

  private isExecutionTarget(value: unknown): value is AIExecutionTarget {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const candidate = value as Partial<Record<keyof AIExecutionTarget, unknown>>;

    return typeof candidate.providerId === "string" && typeof candidate.model === "string";
  }
}
