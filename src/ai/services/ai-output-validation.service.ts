import { InvalidAIOutputValidationPolicyError } from "../safety/ai-output-safety.errors.js";
import type {
  AIDeterministicFallbackPolicy,
  AIOutputNormalizationPolicy,
  AIOutputPatternRule,
  AIOutputValidationFinding,
  AIOutputValidationPolicy,
  AIOutputValidationResult,
  AIOutputValidationRuleId,
} from "../types/ai-output-safety.types.js";
import type { AIFinishReason, AITextGenerationResponse } from "../types/ai-provider.types.js";

const ALLOWED_REGEX_FLAGS = new Set(["i", "m", "s", "u"]);
const STATEFUL_REGEX_FLAGS = new Set(["g", "y", "d"]);

interface CompiledPatternRule {
  readonly id: AIOutputValidationRuleId;
  readonly regex: RegExp;
}

export class AIOutputValidationService {
  public validate(
    response: AITextGenerationResponse,
    policy: AIOutputValidationPolicy,
  ): AIOutputValidationResult {
    this.validatePolicy(policy);

    if (typeof response.content !== "string") {
      throw new InvalidAIOutputValidationPolicyError("AI output content must be a string.", policy.id);
    }

    const originalContent = response.content;
    const normalizedContent = this.normalizeContent(originalContent, policy.normalization);
    const findings: AIOutputValidationFinding[] = [];

    this.evaluateFinishReason(response.finishReason, policy, findings);
    this.evaluateControlCharacters(originalContent, policy, findings);
    this.evaluateEmptyContent(normalizedContent, policy, findings);
    this.evaluateMinimumLength(normalizedContent, policy, findings);
    this.evaluateMaximumLength(normalizedContent, policy, findings);
    this.evaluateRequiredLiterals(normalizedContent, policy, findings);
    this.evaluateForbiddenLiterals(normalizedContent, policy, findings);
    this.evaluateRequiredPatterns(normalizedContent, policy, findings);
    this.evaluateForbiddenPatterns(normalizedContent, policy, findings);
    this.evaluateRepeatedCharacters(normalizedContent, policy, findings);

    const copiedFindings = Object.freeze(findings.map((finding) => Object.freeze({ ...finding })));

    return Object.freeze({
      status: copiedFindings.some((finding) => finding.severity === "error" || finding.severity === "critical")
        ? "invalid"
        : "valid",
      originalContent,
      normalizedContent,
      findings: copiedFindings,
    });
  }

  public normalizeFallbackContent(policy: AIDeterministicFallbackPolicy): string {
    return policy.fallbackContent.trim();
  }

  private normalizeContent(content: string, policy: AIOutputNormalizationPolicy): string {
    let normalized = content;

    if (policy.normalizeLineEndings) {
      normalized = normalized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    }

    if (policy.removeNullBytes) {
      normalized = normalized.split("\u0000").join("");
    }

    if (policy.trimWhitespace) {
      normalized = normalized.trim();
    }

    return normalized;
  }

  private evaluateFinishReason(
    finishReason: AIFinishReason,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    if (!policy.allowedFinishReasons.includes(finishReason)) {
      findings.push(this.finding("finish-reason", "error", "AI_OUTPUT_FINISH_REASON_DISALLOWED", "AI output finish reason is not allowed."));
    }
  }

  private evaluateControlCharacters(
    originalContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    if (!policy.normalization.removeNullBytes && originalContent.includes("\u0000")) {
      findings.push(this.finding("control-character", "error", "AI_OUTPUT_NULL_BYTE_PRESENT", "AI output contains a prohibited null byte."));
    }
  }

  private evaluateEmptyContent(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    if (!policy.allowEmpty && normalizedContent.length === 0) {
      findings.push(this.finding("non-empty", "error", "AI_OUTPUT_EMPTY", "AI output must not be empty."));
    }
  }

  private evaluateMinimumLength(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    if (policy.minimumLength !== undefined && normalizedContent.length < policy.minimumLength) {
      findings.push(this.finding("minimum-length", "error", "AI_OUTPUT_BELOW_MINIMUM_LENGTH", "AI output is shorter than the configured minimum length."));
    }
  }

  private evaluateMaximumLength(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    if (policy.maximumLength !== undefined && normalizedContent.length > policy.maximumLength) {
      findings.push(this.finding("maximum-length", "error", "AI_OUTPUT_ABOVE_MAXIMUM_LENGTH", "AI output is longer than the configured maximum length."));
    }
  }

  private evaluateRequiredLiterals(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    const content = normalizedContent.toLowerCase();

    for (const term of policy.requiredLiteralTerms) {
      if (!content.includes(term.toLowerCase())) {
        findings.push(this.finding("required-literal", "error", "AI_OUTPUT_REQUIRED_LITERAL_MISSING", "AI output is missing a required literal term."));
      }
    }
  }

  private evaluateForbiddenLiterals(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    const content = normalizedContent.toLowerCase();

    for (const term of policy.forbiddenLiteralTerms) {
      if (content.includes(term.toLowerCase())) {
        findings.push(this.finding("forbidden-literal", "critical", "AI_OUTPUT_FORBIDDEN_LITERAL_PRESENT", "AI output contains a forbidden literal term."));
      }
    }
  }

  private evaluateRequiredPatterns(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    for (const pattern of this.compilePatterns(policy.requiredPatterns, policy)) {
      if (!pattern.regex.test(normalizedContent)) {
        findings.push(this.finding(pattern.id, "error", "AI_OUTPUT_REQUIRED_PATTERN_MISSING", "AI output is missing a required pattern match."));
      }
    }
  }

  private evaluateForbiddenPatterns(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    for (const pattern of this.compilePatterns(policy.forbiddenPatterns, policy)) {
      if (pattern.regex.test(normalizedContent)) {
        findings.push(this.finding(pattern.id, "critical", "AI_OUTPUT_FORBIDDEN_PATTERN_PRESENT", "AI output matches a forbidden pattern."));
      }
    }
  }

  private evaluateRepeatedCharacters(
    normalizedContent: string,
    policy: AIOutputValidationPolicy,
    findings: AIOutputValidationFinding[],
  ): void {
    if (policy.maximumRepeatedCharacterRun === undefined || normalizedContent.length === 0) {
      return;
    }

    let currentCharacter = normalizedContent[0];
    let runLength = 1;

    for (let index = 1; index < normalizedContent.length; index += 1) {
      const character = normalizedContent[index];

      if (character === currentCharacter) {
        runLength += 1;

        if (runLength > policy.maximumRepeatedCharacterRun) {
          findings.push(this.finding("repeated-character", "warning", "AI_OUTPUT_REPEATED_CHARACTER_RUN", "AI output contains a repeated character run above the configured limit."));
          return;
        }
      } else {
        currentCharacter = character;
        runLength = 1;
      }
    }
  }

  private validatePolicy(policy: AIOutputValidationPolicy): void {
    if (policy.id.trim().length === 0) {
      throw new InvalidAIOutputValidationPolicyError("AI output validation policy ID must not be empty.");
    }

    if (policy.version.trim().length === 0) {
      throw new InvalidAIOutputValidationPolicyError("AI output validation policy version must not be empty.", policy.id);
    }

    if (policy.minimumLength !== undefined && (!Number.isSafeInteger(policy.minimumLength) || policy.minimumLength < 0)) {
      throw new InvalidAIOutputValidationPolicyError("AI output minimum length must be a non-negative safe integer.", policy.id);
    }

    if (policy.maximumLength !== undefined && (!Number.isSafeInteger(policy.maximumLength) || policy.maximumLength <= 0)) {
      throw new InvalidAIOutputValidationPolicyError("AI output maximum length must be a positive safe integer.", policy.id);
    }

    if (
      policy.minimumLength !== undefined &&
      policy.maximumLength !== undefined &&
      policy.maximumLength < policy.minimumLength
    ) {
      throw new InvalidAIOutputValidationPolicyError("AI output maximum length must not be less than minimum length.", policy.id);
    }

    this.validateLiteralTerms(policy.requiredLiteralTerms, "required", policy.id);
    this.validateLiteralTerms(policy.forbiddenLiteralTerms, "forbidden", policy.id);
    this.validatePatternRules(policy.requiredPatterns, policy.forbiddenPatterns, policy.id);
    this.validateFinishReasons(policy.allowedFinishReasons, policy.id);

    if (
      policy.maximumRepeatedCharacterRun !== undefined &&
      (!Number.isSafeInteger(policy.maximumRepeatedCharacterRun) || policy.maximumRepeatedCharacterRun <= 0)
    ) {
      throw new InvalidAIOutputValidationPolicyError("AI output repeated-character threshold must be a positive safe integer.", policy.id);
    }
  }

  private validateLiteralTerms(terms: readonly string[], label: string, policyId: string): void {
    const seen = new Set<string>();

    for (const term of terms) {
      const normalized = term.trim().toLowerCase();

      if (normalized.length === 0) {
        throw new InvalidAIOutputValidationPolicyError(`AI output ${label} literal terms must not be empty.`, policyId);
      }

      if (seen.has(normalized)) {
        throw new InvalidAIOutputValidationPolicyError(`AI output ${label} literal terms must not contain duplicates.`, policyId);
      }

      seen.add(normalized);
    }
  }

  private validatePatternRules(
    requiredPatterns: readonly AIOutputPatternRule[],
    forbiddenPatterns: readonly AIOutputPatternRule[],
    policyId: string,
  ): void {
    const seenIds = new Set<string>();

    for (const rule of [...requiredPatterns, ...forbiddenPatterns]) {
      if (rule.id.trim().length === 0) {
        throw new InvalidAIOutputValidationPolicyError("AI output pattern rule ID must not be empty.", policyId);
      }

      if (seenIds.has(rule.id)) {
        throw new InvalidAIOutputValidationPolicyError("AI output pattern rule IDs must not contain duplicates.", policyId);
      }

      seenIds.add(rule.id);
      this.compilePattern(rule, policyId);
    }
  }

  private validateFinishReasons(finishReasons: readonly AIFinishReason[], policyId: string): void {
    if (finishReasons.length === 0) {
      throw new InvalidAIOutputValidationPolicyError("AI output allowed finish reasons must not be empty.", policyId);
    }

    const seen = new Set<AIFinishReason>();

    for (const finishReason of finishReasons) {
      if (seen.has(finishReason)) {
        throw new InvalidAIOutputValidationPolicyError("AI output allowed finish reasons must not contain duplicates.", policyId);
      }

      seen.add(finishReason);
    }
  }

  private compilePatterns(
    rules: readonly AIOutputPatternRule[],
    policy: AIOutputValidationPolicy,
  ): readonly CompiledPatternRule[] {
    return rules.map((rule) => this.compilePattern(rule, policy.id));
  }

  private compilePattern(rule: AIOutputPatternRule, policyId: string): CompiledPatternRule {
    const flags = rule.flags ?? "";
    const seenFlags = new Set<string>();

    for (const flag of flags) {
      if (seenFlags.has(flag)) {
        throw new InvalidAIOutputValidationPolicyError("AI output regex flags must not contain duplicates.", policyId);
      }

      if (STATEFUL_REGEX_FLAGS.has(flag) || !ALLOWED_REGEX_FLAGS.has(flag)) {
        throw new InvalidAIOutputValidationPolicyError("AI output regex flags include an unsupported flag.", policyId);
      }

      seenFlags.add(flag);
    }

    try {
      return {
        id: rule.id,
        regex: new RegExp(rule.pattern, flags),
      };
    } catch {
      throw new InvalidAIOutputValidationPolicyError("AI output regex pattern is invalid.", policyId);
    }
  }

  private finding(
    ruleId: AIOutputValidationRuleId,
    severity: AIOutputValidationFinding["severity"],
    code: string,
    message: string,
  ): AIOutputValidationFinding {
    return Object.freeze({
      ruleId,
      severity,
      code,
      message,
    });
  }
}
