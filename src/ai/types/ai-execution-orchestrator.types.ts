import type { AIExecutionPolicyId, AIExecutionPolicyVersion, AIExecutionTarget } from "./ai-execution-policy.types.js";
import type { AITextGenerationResponse } from "./ai-provider.types.js";
import type { AIProviderFailureCategory } from "../providers/ai-provider.errors.js";

export type AIExecutionAttemptStatus = "succeeded" | "failed";

export interface AIExecutionSucceededAttempt {
  readonly attemptNumber: number;
  readonly targetAttemptNumber: number;
  readonly target: AIExecutionTarget;
  readonly status: "succeeded";
}

export interface AIExecutionFailedAttempt {
  readonly attemptNumber: number;
  readonly targetAttemptNumber: number;
  readonly target: AIExecutionTarget;
  readonly status: "failed";
  readonly failureCategory: AIProviderFailureCategory;
  readonly providerStatusCode?: number;
  readonly providerRequestId?: string;
}

export type AIExecutionAttempt = AIExecutionSucceededAttempt | AIExecutionFailedAttempt;

export interface AIExecutionResult {
  readonly policyId: AIExecutionPolicyId;
  readonly policyVersion: AIExecutionPolicyVersion;
  readonly selectedTarget: AIExecutionTarget;
  readonly response: AITextGenerationResponse;
  readonly attempts: readonly AIExecutionAttempt[];
  readonly fallbackUsed: boolean;
  readonly totalAttempts: number;
}
