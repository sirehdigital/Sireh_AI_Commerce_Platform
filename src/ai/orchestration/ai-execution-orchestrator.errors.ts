import type { AIExecutionPolicyId, AIExecutionPolicyVersion, AIExecutionTarget } from "../types/ai-execution-policy.types.js";
import type { AIExecutionAttempt } from "../types/ai-execution-orchestrator.types.js";
import type { AIProviderFailureCategory } from "../providers/ai-provider.errors.js";

export class AIExecutionConfigurationError extends Error {
  public readonly policyId?: AIExecutionPolicyId;
  public readonly policyVersion?: AIExecutionPolicyVersion;
  public readonly target?: AIExecutionTarget;
  public readonly attempts: readonly AIExecutionAttempt[];

  public constructor(
    message: string,
    options: {
      readonly policyId?: AIExecutionPolicyId;
      readonly policyVersion?: AIExecutionPolicyVersion;
      readonly target?: AIExecutionTarget;
      readonly attempts?: readonly AIExecutionAttempt[];
    } = {},
  ) {
    super(message);
    this.name = "AIExecutionConfigurationError";

    if (options.policyId !== undefined) {
      this.policyId = options.policyId;
    }

    if (options.policyVersion !== undefined) {
      this.policyVersion = options.policyVersion;
    }

    if (options.target !== undefined) {
      this.target = copyTarget(options.target);
    }

    this.attempts = copyAttempts(options.attempts ?? []);
  }
}

export class AITerminalExecutionError extends Error {
  public readonly policyId: AIExecutionPolicyId;
  public readonly policyVersion: AIExecutionPolicyVersion;
  public readonly target: AIExecutionTarget;
  public readonly failureCategory: AIProviderFailureCategory;
  public readonly providerStatusCode?: number;
  public readonly providerRequestId?: string;
  public readonly attempts: readonly AIExecutionAttempt[];

  public constructor(options: {
    readonly policyId: AIExecutionPolicyId;
    readonly policyVersion: AIExecutionPolicyVersion;
    readonly target: AIExecutionTarget;
    readonly failureCategory: AIProviderFailureCategory;
    readonly providerStatusCode?: number;
    readonly providerRequestId?: string;
    readonly attempts: readonly AIExecutionAttempt[];
  }) {
    super("AI execution stopped because a terminal provider failure occurred.");
    this.name = "AITerminalExecutionError";
    this.policyId = options.policyId;
    this.policyVersion = options.policyVersion;
    this.target = copyTarget(options.target);
    this.failureCategory = options.failureCategory;

    if (options.providerStatusCode !== undefined) {
      this.providerStatusCode = options.providerStatusCode;
    }

    if (options.providerRequestId !== undefined) {
      this.providerRequestId = options.providerRequestId;
    }

    this.attempts = copyAttempts(options.attempts);
  }
}

export class AIExecutionExhaustedError extends Error {
  public readonly policyId: AIExecutionPolicyId;
  public readonly policyVersion: AIExecutionPolicyVersion;
  public readonly attempts: readonly AIExecutionAttempt[];
  public readonly lastFailureCategory?: AIProviderFailureCategory;

  public constructor(options: {
    readonly policyId: AIExecutionPolicyId;
    readonly policyVersion: AIExecutionPolicyVersion;
    readonly attempts: readonly AIExecutionAttempt[];
    readonly lastFailureCategory?: AIProviderFailureCategory;
  }) {
    super("AI execution failed because all permitted attempts were exhausted.");
    this.name = "AIExecutionExhaustedError";
    this.policyId = options.policyId;
    this.policyVersion = options.policyVersion;
    this.attempts = copyAttempts(options.attempts);

    if (options.lastFailureCategory !== undefined) {
      this.lastFailureCategory = options.lastFailureCategory;
    }
  }
}

function copyAttempts(attempts: readonly AIExecutionAttempt[]): readonly AIExecutionAttempt[] {
  return Object.freeze(
    attempts.map((attempt) => {
      if (attempt.status === "succeeded") {
        return Object.freeze({
          attemptNumber: attempt.attemptNumber,
          targetAttemptNumber: attempt.targetAttemptNumber,
          target: copyTarget(attempt.target),
          status: attempt.status,
        });
      }

      return Object.freeze({
        attemptNumber: attempt.attemptNumber,
        targetAttemptNumber: attempt.targetAttemptNumber,
        target: copyTarget(attempt.target),
        status: attempt.status,
        failureCategory: attempt.failureCategory,
        ...(attempt.providerStatusCode === undefined ? {} : { providerStatusCode: attempt.providerStatusCode }),
        ...(attempt.providerRequestId === undefined ? {} : { providerRequestId: attempt.providerRequestId }),
      });
    }),
  );
}

function copyTarget(target: AIExecutionTarget): AIExecutionTarget {
  return Object.freeze({
    providerId: target.providerId,
    model: target.model,
  });
}
