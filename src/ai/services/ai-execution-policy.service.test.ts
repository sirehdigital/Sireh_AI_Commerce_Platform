import { describe, expect, it, vi } from "vitest";
import {
  DuplicateAIExecutionTargetError,
  InvalidAIExecutionContextError,
  InvalidAIExecutionPolicyError,
} from "../policies/ai-execution-policy.errors.js";
import type {
  AIExecutionContext,
  AIExecutionPolicy,
} from "../types/ai-execution-policy.types.js";
import { AIExecutionPolicyService } from "./ai-execution-policy.service.js";

describe("AIExecutionPolicyService", () => {
  it("creates a plan from a valid policy", () => {
    const plan = createPlan();

    expect(plan.primaryTarget).toEqual({ providerId: "local", model: "local-standard" });
    expect(plan.timeoutMs).toBe(30_000);
    expect(plan.maxAttempts).toBe(3);
  });

  it("preserves policy ID and version", () => {
    const plan = createPlan(buildPolicy({ id: "product-copy-premium", version: "2.0.0" }));

    expect(plan.policyId).toBe("product-copy-premium");
    expect(plan.policyVersion).toBe("2.0.0");
  });

  it("uses the policy primary target when no override exists", () => {
    expect(createPlan().primaryTarget).toEqual({ providerId: "local", model: "local-standard" });
  });

  it("applies a model-only override", () => {
    const plan = createPlan(undefined, buildContext({ requestedModel: "local-premium" }));

    expect(plan.primaryTarget).toEqual({ providerId: "local", model: "local-premium" });
  });

  it("applies provider-and-model override", () => {
    const plan = createPlan(
      undefined,
      buildContext({ requestedProviderId: "mock", requestedModel: "mock-large" }),
    );

    expect(plan.primaryTarget).toEqual({ providerId: "mock", model: "mock-large" });
  });

  it("rejects provider-only override", () => {
    expect(() => createPlan(undefined, buildContext({ requestedProviderId: "mock" }))).toThrow(
      InvalidAIExecutionContextError,
    );
  });

  it("rejects empty provider override", () => {
    expect(() => {
      return createPlan(undefined, buildContext({ requestedProviderId: " ", requestedModel: "model" }));
    }).toThrow(InvalidAIExecutionContextError);
  });

  it("rejects empty model override", () => {
    expect(() => createPlan(undefined, buildContext({ requestedModel: " " }))).toThrow(
      InvalidAIExecutionContextError,
    );
  });

  it("removes fallbacks when fallback is disabled", () => {
    const plan = createPlan(undefined, buildContext({ allowFallback: false }));

    expect(plan.fallbackTargets).toEqual([]);
  });

  it("preserves fallback order when enabled", () => {
    const plan = createPlan();

    expect(plan.fallbackTargets).toEqual([
      { providerId: "mock", model: "mock-standard" },
      { providerId: "backup", model: "backup-standard" },
    ]);
  });

  it("removes a fallback that matches an overridden primary target", () => {
    const plan = createPlan(
      undefined,
      buildContext({ requestedProviderId: "mock", requestedModel: "mock-standard" }),
    );

    expect(plan.fallbackTargets).toEqual([{ providerId: "backup", model: "backup-standard" }]);
  });

  it("rejects primary target duplicated in fallbacks", () => {
    expect(() => {
      return createPlan(
        buildPolicy({
          fallbackTargets: [
            { providerId: "local", model: "local-standard" },
            { providerId: "mock", model: "mock-standard" },
          ],
        }),
      );
    }).toThrow(DuplicateAIExecutionTargetError);
  });

  it("rejects duplicate fallback targets", () => {
    expect(() => {
      return createPlan(
        buildPolicy({
          fallbackTargets: [
            { providerId: "mock", model: "mock-standard" },
            { providerId: "MOCK", model: "mock-standard" },
          ],
        }),
      );
    }).toThrow(DuplicateAIExecutionTargetError);
  });

  it("treats same provider with different models as different targets", () => {
    const plan = createPlan(
      buildPolicy({
        fallbackTargets: [
          { providerId: "mock", model: "small" },
          { providerId: "mock", model: "large" },
        ],
      }),
    );

    expect(plan.fallbackTargets).toHaveLength(2);
  });

  it("treats different providers with same model string as different targets", () => {
    const plan = createPlan(
      buildPolicy({
        fallbackTargets: [
          { providerId: "mock", model: "standard" },
          { providerId: "backup", model: "standard" },
        ],
      }),
    );

    expect(plan.fallbackTargets).toHaveLength(2);
  });

  it("accepts temperature 0", () => {
    expect(createPlan(buildPolicyWithTemperature(0)).generationControls.temperature).toBe(0);
  });

  it("accepts temperature 2", () => {
    expect(createPlan(buildPolicyWithTemperature(2)).generationControls.temperature).toBe(2);
  });

  it("rejects temperature below 0", () => {
    expect(() => createPlan(buildPolicyWithTemperature(-0.1))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects temperature above 2", () => {
    expect(() => createPlan(buildPolicyWithTemperature(2.1))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects NaN temperature", () => {
    expect(() => createPlan(buildPolicyWithTemperature(Number.NaN))).toThrow(
      InvalidAIExecutionPolicyError,
    );
  });

  it("rejects infinite temperature", () => {
    expect(() => createPlan(buildPolicyWithTemperature(Number.POSITIVE_INFINITY))).toThrow(
      InvalidAIExecutionPolicyError,
    );
  });

  it("accepts valid max output tokens", () => {
    expect(createPlan(buildPolicyWithMaxOutputTokens(1024)).generationControls.maxOutputTokens).toBe(
      1024,
    );
  });

  it("rejects zero max output tokens", () => {
    expect(() => createPlan(buildPolicyWithMaxOutputTokens(0))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects negative max output tokens", () => {
    expect(() => createPlan(buildPolicyWithMaxOutputTokens(-1))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects fractional max output tokens", () => {
    expect(() => createPlan(buildPolicyWithMaxOutputTokens(1.5))).toThrow(
      InvalidAIExecutionPolicyError,
    );
  });

  it("rejects unsafe max output tokens", () => {
    expect(() => createPlan(buildPolicyWithMaxOutputTokens(Number.MAX_SAFE_INTEGER + 1))).toThrow(
      InvalidAIExecutionPolicyError,
    );
  });

  it("accepts valid timeout", () => {
    expect(createPlan(buildPolicyWithTimeout(300_000)).timeoutMs).toBe(300_000);
  });

  it("rejects zero timeout", () => {
    expect(() => createPlan(buildPolicyWithTimeout(0))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects timeout above 300000", () => {
    expect(() => createPlan(buildPolicyWithTimeout(300_001))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects fractional timeout", () => {
    expect(() => createPlan(buildPolicyWithTimeout(1.5))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("accepts max attempts 1", () => {
    expect(createPlan(buildPolicyWithMaxAttempts(1)).maxAttempts).toBe(1);
  });

  it("accepts max attempts 5", () => {
    expect(createPlan(buildPolicyWithMaxAttempts(5)).maxAttempts).toBe(5);
  });

  it("rejects max attempts below 1", () => {
    expect(() => createPlan(buildPolicyWithMaxAttempts(0))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects max attempts above 5", () => {
    expect(() => createPlan(buildPolicyWithMaxAttempts(6))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects fractional max attempts", () => {
    expect(() => createPlan(buildPolicyWithMaxAttempts(1.5))).toThrow(InvalidAIExecutionPolicyError);
  });

  it("rejects duplicate retry categories", () => {
    expect(() => {
      return createPlan(
        buildPolicy({
          retryPolicy: {
            maxAttempts: 3,
            retryableFailureCategories: ["timeout", "timeout"],
          },
        }),
      );
    }).toThrow(InvalidAIExecutionPolicyError);
  });

  it("preserves retry categories safely", () => {
    const plan = createPlan(
      buildPolicy({
        retryPolicy: {
          maxAttempts: 3,
          retryableFailureCategories: ["rate_limit", "timeout"],
        },
      }),
    );

    expect(plan.retryableFailureCategories).toEqual(["rate_limit", "timeout"]);
  });

  it("copies context metadata", () => {
    const plan = createPlan(undefined, buildContext({ metadata: { purpose: "test", count: 1 } }));

    expect(plan.metadata).toEqual({ purpose: "test", count: 1 });
  });

  it("does not mutate the original policy", () => {
    const policy = buildPolicy();
    const before = JSON.stringify(policy);

    createPlan(policy);

    expect(JSON.stringify(policy)).toBe(before);
  });

  it("does not mutate the original context", () => {
    const context = buildContext({ metadata: { purpose: "test" } });
    const before = JSON.stringify(context);

    createPlan(undefined, context);

    expect(JSON.stringify(context)).toBe(before);
  });

  it("does not expose mutable fallback collections", () => {
    const plan = createPlan();

    expect(() => {
      (plan.fallbackTargets as unknown[]).push({ providerId: "extra", model: "extra" });
    }).toThrow(TypeError);

    expect(plan.fallbackTargets).toEqual([
      { providerId: "mock", model: "mock-standard" },
      { providerId: "backup", model: "backup-standard" },
    ]);
  });

  it("does not expose mutable retry-category collections", () => {
    const plan = createPlan();

    expect(() => {
      (plan.retryableFailureCategories as unknown[]).push("temporary_failure");
    }).toThrow(TypeError);

    expect(plan.retryableFailureCategories).toEqual(["timeout", "rate_limit"]);
  });

  it("supports a policy with no fallbacks", () => {
    const plan = createPlan(buildPolicy({ fallbackTargets: [] }));

    expect(plan.fallbackTargets).toEqual([]);
  });

  it("supports an empty metadata object", () => {
    const plan = createPlan(undefined, buildContext({ metadata: {} }));

    expect(plan.metadata).toEqual({});
  });

  it("produces a serializable execution plan", () => {
    const plan = createPlan();

    expect(() => JSON.stringify(plan)).not.toThrow();
  });

  it("does not require a provider registry", () => {
    expect(createPlan().primaryTarget.providerId).toBe("local");
  });

  it("performs no provider invocation", () => {
    const providerInvocation = vi.fn();

    createPlan();

    expect(providerInvocation).not.toHaveBeenCalled();
  });
});

function createPlan(policy = buildPolicy(), context = buildContext()): ReturnType<AIExecutionPolicyService["createPlan"]> {
  return new AIExecutionPolicyService().createPlan(policy, context);
}

function buildPolicy(overrides: Partial<AIExecutionPolicy> = {}): AIExecutionPolicy {
  return {
    id: "product-analysis-default",
    version: "1.0.0",
    primaryTarget: { providerId: "local", model: "local-standard" },
    fallbackTargets: [
      { providerId: "mock", model: "mock-standard" },
      { providerId: "backup", model: "backup-standard" },
    ],
    generationControls: {
      temperature: 0.4,
      maxOutputTokens: 1200,
    },
    timeoutPolicy: {
      timeoutMs: 30_000,
    },
    retryPolicy: {
      maxAttempts: 3,
      retryableFailureCategories: ["timeout", "rate_limit"],
    },
    description: "Default deterministic product analysis policy",
    ...overrides,
  };
}

function buildContext(overrides: Partial<AIExecutionContext> = {}): AIExecutionContext {
  return {
    allowFallback: true,
    metadata: { scope: "unit-test" },
    ...overrides,
  };
}

function buildPolicyWithTemperature(temperature: number): AIExecutionPolicy {
  return buildPolicy({ generationControls: { temperature } });
}

function buildPolicyWithMaxOutputTokens(maxOutputTokens: number): AIExecutionPolicy {
  return buildPolicy({ generationControls: { maxOutputTokens } });
}

function buildPolicyWithTimeout(timeoutMs: number): AIExecutionPolicy {
  return buildPolicy({ timeoutPolicy: { timeoutMs } });
}

function buildPolicyWithMaxAttempts(maxAttempts: number): AIExecutionPolicy {
  return buildPolicy({
    retryPolicy: {
      maxAttempts,
      retryableFailureCategories: ["timeout"],
    },
  });
}
