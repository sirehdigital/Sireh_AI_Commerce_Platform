import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InvalidAIFallbackPolicyError } from "../safety/ai-output-safety.errors.js";
import type {
  AIDeterministicFallbackPolicy,
  AISafetyDecisionPolicy,
  AIOutputValidationPolicy,
} from "../types/ai-output-safety.types.js";
import type { AITextGenerationResponse } from "../types/ai-provider.types.js";
import { AISafetyEvaluationService } from "./ai-safety-evaluation.service.js";
import { AIOutputGuardService } from "./ai-output-guard.service.js";
import { AIOutputValidationService } from "./ai-output-validation.service.js";

class CountingValidationService extends AIOutputValidationService {
  public calls = 0;

  public override validate(response: AITextGenerationResponse, policy: AIOutputValidationPolicy) {
    this.calls += 1;
    return super.validate(response, policy);
  }
}

class CountingSafetyService extends AISafetyEvaluationService {
  public calls = 0;

  public override evaluate(
    validation: ReturnType<AIOutputValidationService["validate"]>,
    policy: AISafetyDecisionPolicy,
  ) {
    this.calls += 1;
    return super.evaluate(validation, policy);
  }
}

describe("AIOutputGuardService", () => {
  it("accepts valid fallback policy", () => {
    expect(() => guard()).not.toThrow();
  });

  it("rejects empty fallback ID", () => {
    expect(() => guard({ fallbackPolicy: fallback({ id: "" }) })).toThrow(InvalidAIFallbackPolicyError);
  });

  it("rejects empty fallback version", () => {
    expect(() => guard({ fallbackPolicy: fallback({ version: "" }) })).toThrow(InvalidAIFallbackPolicyError);
  });

  it("rejects empty fallback content", () => {
    expect(() => guard({ fallbackPolicy: fallback({ fallbackContent: "" }) })).toThrow(InvalidAIFallbackPolicyError);
  });

  it("rejects whitespace-only fallback content", () => {
    expect(() => guard({ fallbackPolicy: fallback({ fallbackContent: "   " }) })).toThrow(
      InvalidAIFallbackPolicyError,
    );
  });

  it("normalizes fallback content deterministically", () => {
    const result = guard({
      response: response("banned"),
      validationPolicy: validationPolicy({ forbiddenLiteralTerms: ["banned"] }),
      fallbackPolicy: fallback({ fallbackContent: "  Safe fallback.  " }),
    });

    expect(result.content).toBe("Safe fallback.");
  });

  it("returns normalized output on allow", () => {
    expect(guard({ response: response("  Safe content  ") }).content).toBe("Safe content");
  });

  it("returns normalized output on allow_with_warnings", () => {
    const result = guard({
      response: response("!!!!!!"),
      validationPolicy: validationPolicy({ maximumRepeatedCharacterRun: 5 }),
    });

    expect(result.safetyDecision).toBe("allow_with_warnings");
    expect(result.content).toBe("!!!!!!");
  });

  it("does not use fallback for warnings", () => {
    const result = guard({
      response: response("!!!!!!"),
      validationPolicy: validationPolicy({ maximumRepeatedCharacterRun: 5 }),
    });

    expect(result.usedFallback).toBe(false);
  });

  it("returns fallback content on reject", () => {
    expect(rejectedResult().content).toBe("The requested content could not be generated safely.");
  });

  it("sets usedFallback true on reject", () => {
    expect(rejectedResult().usedFallback).toBe(true);
  });

  it("sets usedFallback false on allow", () => {
    expect(guard().usedFallback).toBe(false);
  });

  it("preserves validation-policy ID and version", () => {
    const result = guard({ validationPolicy: validationPolicy({ id: "policy.custom", version: "2.0.0" }) });

    expect(result.policyId).toBe("policy.custom");
    expect(result.policyVersion).toBe("2.0.0");
  });

  it("preserves fallback-policy ID and version when used", () => {
    const result = rejectedResult(fallback({ id: "fallback.custom", version: "3.0.0" }));

    expect(result.fallbackPolicyId).toBe("fallback.custom");
    expect(result.fallbackPolicyVersion).toBe("3.0.0");
  });

  it("does not expose rejected output as returned public content", () => {
    const result = guard({
      response: response("secret banned output"),
      validationPolicy: validationPolicy({ forbiddenLiteralTerms: ["banned"] }),
    });

    expect(result.content).not.toContain("secret banned output");
  });

  it("does not mutate provider response", () => {
    const providerResponse = response("  Safe content  ");
    const snapshot = JSON.stringify(providerResponse);

    guard({ response: providerResponse });

    expect(JSON.stringify(providerResponse)).toBe(snapshot);
  });

  it("does not mutate validation policy", () => {
    const policy = validationPolicy();
    const snapshot = JSON.stringify(policy);

    guard({ validationPolicy: policy });

    expect(JSON.stringify(policy)).toBe(snapshot);
  });

  it("does not mutate safety policy", () => {
    const policy = safetyPolicy();
    const snapshot = JSON.stringify(policy);

    guard({ safetyPolicy: policy });

    expect(JSON.stringify(policy)).toBe(snapshot);
  });

  it("does not mutate fallback policy", () => {
    const policy = fallback();
    const snapshot = JSON.stringify(policy);

    guard({ fallbackPolicy: policy });

    expect(JSON.stringify(policy)).toBe(snapshot);
  });

  it("validates all supplied policies", () => {
    expect(() => guard({ fallbackPolicy: fallback({ fallbackContent: "" }) })).toThrow(
      InvalidAIFallbackPolicyError,
    );
  });

  it("uses injected validation and safety services", () => {
    const validation = new CountingValidationService();
    const safety = new CountingSafetyService();
    const service = new AIOutputGuardService(validation, safety);

    service.guard(response(), validationPolicy(), safetyPolicy(), fallback());

    expect(validation.calls).toBe(1);
    expect(safety.calls).toBe(1);
  });

  it("performs no provider invocation", () => {
    expect(readGuardSource()).not.toContain("generateText");
  });

  it("performs no retry", () => {
    expect(readGuardSource()).not.toContain("retry");
  });

  it("performs no provider fallback", () => {
    expect(readGuardSource()).not.toContain("fallbackTargets");
  });

  it("produces a serializable guarded result", () => {
    const result = guard();

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("contains no provider SDK imports", () => {
    const source = readGuardSource();

    expect(source).not.toContain("@google/genai");
    expect(source).not.toContain("@anthropic-ai/sdk");
    expect(source).not.toContain("openai");
  });

  it("does not require provider registry", () => {
    expect(readGuardSource()).not.toContain("AIProviderRegistryService");
  });

  it("does not require execution policy service", () => {
    expect(readGuardSource()).not.toContain("AIExecutionPolicyService");
  });

  it("does not require execution orchestrator", () => {
    expect(readGuardSource()).not.toContain("AIExecutionOrchestratorService");
  });

  it("does not read environment variables", () => {
    expect(readGuardSource()).not.toContain("process.env");
  });

  it("performs no Shopify operation", () => {
    expect(readGuardSource()).not.toContain("shopify");
  });

  it("performs no AI Product Engine operation", () => {
    expect(readGuardSource()).not.toContain("ai-product");
  });

  it("uses no database, randomness, timestamps or external moderation service", () => {
    const source = readGuardSource();

    expect(source).not.toContain("prisma");
    expect(source).not.toContain("random");
    expect(source).not.toContain("Date");
    expect(source).not.toContain("moderation");
  });
});

function guard(options: {
  readonly response?: AITextGenerationResponse;
  readonly validationPolicy?: AIOutputValidationPolicy;
  readonly safetyPolicy?: AISafetyDecisionPolicy;
  readonly fallbackPolicy?: AIDeterministicFallbackPolicy;
} = {}) {
  return new AIOutputGuardService(
    new AIOutputValidationService(),
    new AISafetyEvaluationService(),
  ).guard(
    options.response ?? response(),
    options.validationPolicy ?? validationPolicy(),
    options.safetyPolicy ?? safetyPolicy(),
    options.fallbackPolicy ?? fallback(),
  );
}

function rejectedResult(policy = fallback()) {
  return guard({
    response: response("banned"),
    validationPolicy: validationPolicy({ forbiddenLiteralTerms: ["banned"] }),
    fallbackPolicy: policy,
  });
}

function response(content = "Safe content"): AITextGenerationResponse {
  return {
    providerId: "fake",
    model: "fake-model",
    content,
    finishReason: "completed",
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    },
  };
}

function validationPolicy(overrides: Partial<AIOutputValidationPolicy> = {}): AIOutputValidationPolicy {
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

function safetyPolicy(): AISafetyDecisionPolicy {
  return {
    rejectOnSeverities: ["error", "critical"],
    warnOnSeverities: ["warning"],
  };
}

function fallback(overrides: Partial<AIDeterministicFallbackPolicy> = {}): AIDeterministicFallbackPolicy {
  return {
    id: "fallback.output",
    version: "1.0.0",
    fallbackContent: "The requested content could not be generated safely.",
    ...overrides,
  };
}

function readGuardSource(): string {
  return readFileSync("src/ai/services/ai-output-guard.service.ts", "utf8");
}
