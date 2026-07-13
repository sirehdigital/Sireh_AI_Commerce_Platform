import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InvalidAIOutputValidationPolicyError } from "../safety/ai-output-safety.errors.js";
import type {
  AIOutputPatternRule,
  AIOutputValidationFinding,
  AIOutputValidationPolicy,
} from "../types/ai-output-safety.types.js";
import type { AIFinishReason, AITextGenerationResponse } from "../types/ai-provider.types.js";
import { AIOutputValidationService } from "./ai-output-validation.service.js";

describe("AIOutputValidationService", () => {
  it("accepts a valid output-validation policy", () => {
    expect(() => validate()).not.toThrow();
  });

  it("rejects empty policy ID", () => {
    expect(() => validate("content", policy({ id: "" }))).toThrow(InvalidAIOutputValidationPolicyError);
  });

  it("rejects empty policy version", () => {
    expect(() => validate("content", policy({ version: "" }))).toThrow(InvalidAIOutputValidationPolicyError);
  });

  it("rejects negative minimum length", () => {
    expect(() => validate("content", policy({ minimumLength: -1 }))).toThrow(InvalidAIOutputValidationPolicyError);
  });

  it("rejects zero maximum length", () => {
    expect(() => validate("content", policy({ maximumLength: 0 }))).toThrow(InvalidAIOutputValidationPolicyError);
  });

  it("rejects maximum below minimum", () => {
    expect(() => validate("content", policy({ minimumLength: 5, maximumLength: 4 }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects empty required literal", () => {
    expect(() => validate("content", policy({ requiredLiteralTerms: [" "] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects empty forbidden literal", () => {
    expect(() => validate("content", policy({ forbiddenLiteralTerms: [""] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects duplicate required literals case-insensitively", () => {
    expect(() => validate("content", policy({ requiredLiteralTerms: ["Sale", "sale"] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects duplicate forbidden literals case-insensitively", () => {
    expect(() => validate("content", policy({ forbiddenLiteralTerms: ["Banned", "banned"] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects invalid regex syntax", () => {
    expect(() => validate("content", policy({ requiredPatterns: [pattern("required", "[" )] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects unsupported regex flags", () => {
    expect(() => validate("content", policy({ requiredPatterns: [pattern("required", "x", "g")] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects duplicate regex flags", () => {
    expect(() => validate("content", policy({ requiredPatterns: [pattern("required", "x", "ii")] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects empty allowed finish reasons", () => {
    expect(() => validate("content", policy({ allowedFinishReasons: [] }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects duplicate allowed finish reasons", () => {
    expect(() =>
      validate("content", policy({ allowedFinishReasons: ["completed", "completed"] })),
    ).toThrow(InvalidAIOutputValidationPolicyError);
  });

  it("rejects invalid repeated-character threshold", () => {
    expect(() => validate("content", policy({ maximumRepeatedCharacterRun: 0 }))).toThrow(
      InvalidAIOutputValidationPolicyError,
    );
  });

  it("rejects duplicate pattern IDs", () => {
    expect(() =>
      validate("content", policy({
        requiredPatterns: [pattern("same", "a")],
        forbiddenPatterns: [pattern("same", "b")],
      })),
    ).toThrow(InvalidAIOutputValidationPolicyError);
  });

  it("preserves content when all normalization controls are disabled", () => {
    const result = validate("  A\r\nB\u0000  ", policy({
      normalization: { trimWhitespace: false, normalizeLineEndings: false, removeNullBytes: false },
      allowedFinishReasons: ["completed"],
      allowEmpty: true,
    }));

    expect(result.normalizedContent).toBe("  A\r\nB\u0000  ");
  });

  it("normalizes CRLF to LF", () => {
    expect(validate("a\r\nb").normalizedContent).toBe("a\nb");
  });

  it("normalizes CR to LF", () => {
    expect(validate("a\rb").normalizedContent).toBe("a\nb");
  });

  it("removes null bytes when enabled", () => {
    expect(validate("a\u0000b").normalizedContent).toBe("ab");
  });

  it("reports null bytes when removal is disabled", () => {
    const result = validate("a\u0000b", policy({
      normalization: { trimWhitespace: true, normalizeLineEndings: true, removeNullBytes: false },
    }));

    expect(codes(result.findings)).toContain("AI_OUTPUT_NULL_BYTE_PRESENT");
  });

  it("trims outer whitespace when enabled", () => {
    expect(validate("  content  ").normalizedContent).toBe("content");
  });

  it("preserves internal whitespace", () => {
    expect(validate("  a   b  ").normalizedContent).toBe("a   b");
  });

  it("does not mutate original response content", () => {
    const response = buildResponse("  content  ");

    validate(response.content, basePolicy(), response);

    expect(response.content).toBe("  content  ");
  });

  it("rejects empty output when not allowed", () => {
    expect(validate("", policy({ allowEmpty: false })).status).toBe("invalid");
  });

  it("rejects whitespace-only output after trimming", () => {
    expect(validate("   ", policy({ allowEmpty: false })).status).toBe("invalid");
  });

  it("allows empty output when configured", () => {
    expect(validate("", policy({ allowEmpty: true })).status).toBe("valid");
  });

  it("enforces minimum length", () => {
    expect(codes(validate("abc", policy({ minimumLength: 4 })).findings)).toContain(
      "AI_OUTPUT_BELOW_MINIMUM_LENGTH",
    );
  });

  it("enforces maximum length", () => {
    expect(codes(validate("abcde", policy({ maximumLength: 4 })).findings)).toContain(
      "AI_OUTPUT_ABOVE_MAXIMUM_LENGTH",
    );
  });

  it("accepts exact minimum length", () => {
    expect(validate("abcd", policy({ minimumLength: 4 })).status).toBe("valid");
  });

  it("accepts exact maximum length", () => {
    expect(validate("abcd", policy({ maximumLength: 4 })).status).toBe("valid");
  });

  it("does not truncate overlong output", () => {
    expect(validate("abcde", policy({ maximumLength: 4 })).normalizedContent).toBe("abcde");
  });

  it("detects required literal terms", () => {
    expect(validate("Strong product benefit", policy({ requiredLiteralTerms: ["benefit"] })).status).toBe("valid");
  });

  it("reports missing required literal", () => {
    expect(codes(validate("Strong product", policy({ requiredLiteralTerms: ["benefit"] })).findings)).toContain(
      "AI_OUTPUT_REQUIRED_LITERAL_MISSING",
    );
  });

  it("matches literals case-insensitively", () => {
    expect(validate("STRONG BENEFIT", policy({ requiredLiteralTerms: ["benefit"] })).status).toBe("valid");
  });

  it("detects forbidden literal", () => {
    expect(codes(validate("Contains banned term", policy({ forbiddenLiteralTerms: ["banned"] })).findings)).toContain(
      "AI_OUTPUT_FORBIDDEN_LITERAL_PRESENT",
    );
  });

  it("produces critical finding for forbidden literal", () => {
    expect(validate("banned", policy({ forbiddenLiteralTerms: ["banned"] })).findings[0]?.severity).toBe("critical");
  });

  it("preserves literal-rule finding order", () => {
    const result = validate("clean", policy({
      requiredLiteralTerms: ["first", "second"],
      forbiddenLiteralTerms: ["clean"],
    }));

    expect(codes(result.findings)).toEqual([
      "AI_OUTPUT_REQUIRED_LITERAL_MISSING",
      "AI_OUTPUT_REQUIRED_LITERAL_MISSING",
      "AI_OUTPUT_FORBIDDEN_LITERAL_PRESENT",
    ]);
  });

  it("does not mutate configured literal collections", () => {
    const requiredLiteralTerms = ["benefit"];
    const forbiddenLiteralTerms = ["banned"];

    validate("benefit", policy({ requiredLiteralTerms, forbiddenLiteralTerms }));

    expect(requiredLiteralTerms).toEqual(["benefit"]);
    expect(forbiddenLiteralTerms).toEqual(["banned"]);
  });

  it("accepts matching required pattern", () => {
    expect(validate("SKU-123", policy({ requiredPatterns: [pattern("sku", "SKU-\\d+")] })).status).toBe("valid");
  });

  it("reports missing required pattern", () => {
    expect(codes(validate("missing", policy({ requiredPatterns: [pattern("sku", "SKU-\\d+")] })).findings)).toContain(
      "AI_OUTPUT_REQUIRED_PATTERN_MISSING",
    );
  });

  it("detects forbidden pattern", () => {
    expect(codes(validate("buy now!!!", policy({ forbiddenPatterns: [pattern("spam", "!{3,}")] })).findings)).toContain(
      "AI_OUTPUT_FORBIDDEN_PATTERN_PRESENT",
    );
  });

  it("produces critical finding for forbidden pattern", () => {
    expect(validate("!!!", policy({ forbiddenPatterns: [pattern("spam", "!{3,}")] })).findings[0]?.severity).toBe(
      "critical",
    );
  });

  it("supports allowed regex flags", () => {
    expect(validate("Benefit", policy({ requiredPatterns: [pattern("benefit", "benefit", "iu")] })).status).toBe(
      "valid",
    );
  });

  it("executes patterns deterministically without global-state bugs", () => {
    const validationPolicy = policy({ requiredPatterns: [pattern("benefit", "benefit", "i")] });

    expect(validate("Benefit", validationPolicy).status).toBe("valid");
    expect(validate("Benefit", validationPolicy).status).toBe("valid");
  });

  it("preserves pattern finding order", () => {
    const result = validate("clean", policy({
      requiredPatterns: [pattern("first", "first"), pattern("second", "second")],
      forbiddenPatterns: [pattern("third", "clean")],
    }));

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["first", "second", "third"]);
  });

  it("does not expose complete matched content", () => {
    const finding = validate("secret forbidden phrase", policy({
      forbiddenPatterns: [pattern("secret-pattern", "secret forbidden phrase")],
    })).findings[0];

    expect(JSON.stringify(finding)).not.toContain("secret forbidden phrase");
  });

  it("accepts a run at the configured limit", () => {
    expect(validate("!!!!!", policy({ maximumRepeatedCharacterRun: 5 })).status).toBe("valid");
  });

  it("reports a run above the configured limit", () => {
    expect(codes(validate("!!!!!!", policy({ maximumRepeatedCharacterRun: 5 })).findings)).toContain(
      "AI_OUTPUT_REPEATED_CHARACTER_RUN",
    );
  });

  it("uses warning severity for repeated-character run", () => {
    expect(validate("!!!!!!", policy({ maximumRepeatedCharacterRun: 5 })).findings[0]?.severity).toBe("warning");
  });

  it("does not modify repeated content", () => {
    expect(validate("!!!!!!", policy({ maximumRepeatedCharacterRun: 5 })).normalizedContent).toBe("!!!!!!");
  });

  it("supports output without repeated characters", () => {
    expect(validate("abcdef", policy({ maximumRepeatedCharacterRun: 2 })).status).toBe("valid");
  });

  for (const finishReason of ["completed", "max_tokens"] as const) {
    it(`accepts allowed ${finishReason}`, () => {
      expect(validate("content", policy({ allowedFinishReasons: [finishReason] }), buildResponse("content", finishReason)).status).toBe("valid");
    });
  }

  it("rejects a disallowed finish reason", () => {
    expect(codes(validate("content", policy({ allowedFinishReasons: ["completed"] }), buildResponse("content", "error")).findings)).toContain(
      "AI_OUTPUT_FINISH_REASON_DISALLOWED",
    );
  });

  it("preserves provider finish reason", () => {
    const response = buildResponse("content", "max_tokens");

    validate("content", policy({ allowedFinishReasons: ["max_tokens"] }), response);

    expect(response.finishReason).toBe("max_tokens");
  });

  it("does not modify provider response", () => {
    const response = buildResponse("  content  ");
    const snapshot = JSON.stringify(response);

    validate(response.content, basePolicy(), response);

    expect(JSON.stringify(response)).toBe(snapshot);
  });

  it("returns valid with no findings", () => {
    expect(validate("content").status).toBe("valid");
  });

  it("returns valid with warnings only", () => {
    expect(validate("!!!!!!", policy({ maximumRepeatedCharacterRun: 5 })).status).toBe("valid");
  });

  it("returns invalid with error finding", () => {
    expect(validate("", policy({ allowEmpty: false })).status).toBe("invalid");
  });

  it("returns invalid with critical finding", () => {
    expect(validate("banned", policy({ forbiddenLiteralTerms: ["banned"] })).status).toBe("invalid");
  });

  it("preserves deterministic finding order", () => {
    const result = validate("\u0000", policy({
      normalization: { trimWhitespace: true, normalizeLineEndings: true, removeNullBytes: false },
      allowEmpty: false,
      minimumLength: 2,
      requiredLiteralTerms: ["required"],
      forbiddenLiteralTerms: ["\u0000"],
      requiredPatterns: [pattern("required-pattern", "required")],
      forbiddenPatterns: [pattern("forbidden-pattern", "\\u0000")],
      maximumRepeatedCharacterRun: 1,
      allowedFinishReasons: ["max_tokens"],
    }), buildResponse("\u0000", "completed"));

    expect(codes(result.findings)).toEqual([
      "AI_OUTPUT_FINISH_REASON_DISALLOWED",
      "AI_OUTPUT_NULL_BYTE_PRESENT",
      "AI_OUTPUT_BELOW_MINIMUM_LENGTH",
      "AI_OUTPUT_REQUIRED_LITERAL_MISSING",
      "AI_OUTPUT_FORBIDDEN_LITERAL_PRESENT",
      "AI_OUTPUT_REQUIRED_PATTERN_MISSING",
      "AI_OUTPUT_FORBIDDEN_PATTERN_PRESENT",
    ]);
  });

  it("returns readonly defensive finding collection", () => {
    expect(Object.isFrozen(validate("content").findings)).toBe(true);
  });

  it("produces a serializable validation result", () => {
    const result = validate("content");

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("contains no provider SDK imports", () => {
    const source = readFileSync("src/ai/services/ai-output-validation.service.ts", "utf8");

    expect(source).not.toContain("@google/genai");
    expect(source).not.toContain("@anthropic-ai/sdk");
    expect(source).not.toContain("openai");
  });
});

function validate(
  content = "content",
  validationPolicy = basePolicy(),
  response = buildResponse(content),
) {
  return new AIOutputValidationService().validate(response, validationPolicy);
}

function basePolicy(): AIOutputValidationPolicy {
  return policy();
}

function policy(overrides: Partial<AIOutputValidationPolicy> = {}): AIOutputValidationPolicy {
  return {
    id: "policy.output",
    version: "1.0.0",
    normalization: {
      trimWhitespace: true,
      normalizeLineEndings: true,
      removeNullBytes: true,
    },
    allowEmpty: false,
    requiredLiteralTerms: [],
    forbiddenLiteralTerms: [],
    requiredPatterns: [],
    forbiddenPatterns: [],
    allowedFinishReasons: ["completed", "max_tokens", "unknown"],
    ...overrides,
  };
}

function pattern(id: string, value: string, flags?: string): AIOutputPatternRule {
  return {
    id,
    pattern: value,
    ...(flags === undefined ? {} : { flags }),
  };
}

function buildResponse(content: string, finishReason: AIFinishReason = "completed"): AITextGenerationResponse {
  return {
    providerId: "fake",
    model: "fake-model",
    content,
    finishReason,
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    },
  };
}

function codes(findings: readonly AIOutputValidationFinding[]): readonly string[] {
  return findings.map((finding) => finding.code);
}
