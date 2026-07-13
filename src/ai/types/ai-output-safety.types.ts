import type { AIFinishReason } from "./ai-provider.types.js";

export type AIOutputValidationRuleId = string;

export type AIOutputValidationSeverity = "info" | "warning" | "error" | "critical";

export type AIOutputValidationStatus = "valid" | "invalid";

export type AISafetyDecision = "allow" | "allow_with_warnings" | "reject";

export interface AIOutputValidationFinding {
  readonly ruleId: AIOutputValidationRuleId;
  readonly severity: AIOutputValidationSeverity;
  readonly code: string;
  readonly message: string;
}

export interface AIOutputValidationResult {
  readonly status: AIOutputValidationStatus;
  readonly originalContent: string;
  readonly normalizedContent: string;
  readonly findings: readonly AIOutputValidationFinding[];
}

export interface AIOutputNormalizationPolicy {
  readonly trimWhitespace: boolean;
  readonly normalizeLineEndings: boolean;
  readonly removeNullBytes: boolean;
}

export interface AIOutputPatternRule {
  readonly id: AIOutputValidationRuleId;
  readonly pattern: string;
  readonly flags?: string;
}

export interface AIOutputValidationPolicy {
  readonly id: string;
  readonly version: string;
  readonly normalization: AIOutputNormalizationPolicy;
  readonly allowEmpty: boolean;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
  readonly requiredLiteralTerms: readonly string[];
  readonly forbiddenLiteralTerms: readonly string[];
  readonly requiredPatterns: readonly AIOutputPatternRule[];
  readonly forbiddenPatterns: readonly AIOutputPatternRule[];
  readonly allowedFinishReasons: readonly AIFinishReason[];
  readonly maximumRepeatedCharacterRun?: number;
}

export interface AISafetyEvaluationResult {
  readonly decision: AISafetyDecision;
  readonly findings: readonly AIOutputValidationFinding[];
  readonly highestSeverity?: AIOutputValidationSeverity;
}

export interface AISafetyDecisionPolicy {
  readonly rejectOnSeverities: readonly AIOutputValidationSeverity[];
  readonly warnOnSeverities: readonly AIOutputValidationSeverity[];
}

export interface AIDeterministicFallbackPolicy {
  readonly id: string;
  readonly version: string;
  readonly fallbackContent: string;
  readonly reasonCode?: string;
}

export interface GuardedAIOutputResult {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly safetyDecision: AISafetyDecision;
  readonly content: string;
  readonly usedFallback: boolean;
  readonly validation: AIOutputValidationResult;
  readonly fallbackPolicyId?: string;
  readonly fallbackPolicyVersion?: string;
}
