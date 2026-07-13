import type { AIMetadata, AIModelId, AIProviderId } from "./ai-provider.types.js";

export type AIExecutionPolicyId = string;

export type AIExecutionPolicyVersion = string;

export type AIRetryableFailureCategory =
  | "timeout"
  | "rate_limit"
  | "provider_unavailable"
  | "temporary_failure";

export interface AIExecutionTarget {
  readonly providerId: AIProviderId;
  readonly model: AIModelId;
}

export interface AIGenerationControls {
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface AITimeoutPolicy {
  readonly timeoutMs: number;
}

export interface AIRetryPolicy {
  readonly maxAttempts: number;
  readonly retryableFailureCategories: readonly AIRetryableFailureCategory[];
}

export interface AIExecutionPolicy {
  readonly id: AIExecutionPolicyId;
  readonly version: AIExecutionPolicyVersion;
  readonly primaryTarget: AIExecutionTarget;
  readonly fallbackTargets: readonly AIExecutionTarget[];
  readonly generationControls: AIGenerationControls;
  readonly timeoutPolicy: AITimeoutPolicy;
  readonly retryPolicy: AIRetryPolicy;
  readonly description?: string;
}

export interface AIExecutionContext {
  readonly requestedProviderId?: AIProviderId;
  readonly requestedModel?: AIModelId;
  readonly allowFallback: boolean;
  readonly metadata?: AIMetadata;
}

export interface AIExecutionPlan {
  readonly policyId: AIExecutionPolicyId;
  readonly policyVersion: AIExecutionPolicyVersion;
  readonly primaryTarget: AIExecutionTarget;
  readonly fallbackTargets: readonly AIExecutionTarget[];
  readonly generationControls: AIGenerationControls;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly retryableFailureCategories: readonly AIRetryableFailureCategory[];
  readonly metadata: AIMetadata;
}
