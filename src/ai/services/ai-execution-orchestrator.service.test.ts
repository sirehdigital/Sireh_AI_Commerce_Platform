import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AIExecutionConfigurationError,
  AIExecutionExhaustedError,
  AITerminalExecutionError,
} from "../orchestration/ai-execution-orchestrator.errors.js";
import {
  AIProviderExecutionError,
  type AIProviderFailureCategory,
} from "../providers/ai-provider.errors.js";
import type { AIProviderPort } from "../providers/ai-provider.port.js";
import type {
  AIExecutionPlan,
  AIExecutionTarget,
  AIRetryableFailureCategory,
} from "../types/ai-execution-policy.types.js";
import type { AIExecutionResult } from "../types/ai-execution-orchestrator.types.js";
import type {
  AIFinishReason,
  AIMetadata,
  AIProviderCapabilities,
  AIProviderId,
  AITextGenerationRequest,
  AITextGenerationResponse,
} from "../types/ai-provider.types.js";
import type { RenderedPrompt } from "../types/prompt.types.js";
import { AIExecutionOrchestratorService } from "./ai-execution-orchestrator.service.js";
import { AIProviderRegistryService } from "./ai-provider-registry.service.js";

const DEFAULT_CAPABILITIES: AIProviderCapabilities = {
  textGeneration: true,
  systemMessages: true,
  temperatureControl: true,
  maxOutputTokensControl: true,
};

type ProviderOutcome =
  | { readonly type: "success"; readonly finishReason?: AIFinishReason; readonly content?: string }
  | {
      readonly type: "failure";
      readonly category: AIProviderFailureCategory;
      readonly providerStatusCode?: number;
      readonly providerRequestId?: string;
    }
  | { readonly type: "throw"; readonly error: Error };

class FakeAIProvider implements AIProviderPort {
  public readonly capabilities = DEFAULT_CAPABILITIES;
  public readonly calls: AITextGenerationRequest[] = [];
  private readonly outcomes: ProviderOutcome[];

  public constructor(
    public readonly providerId: AIProviderId,
    outcomes: readonly ProviderOutcome[] = [success()],
  ) {
    this.outcomes = [...outcomes];
  }

  public generateText(request: AITextGenerationRequest): Promise<AITextGenerationResponse> {
    this.calls.push(copyRequest(request));

    const outcome = this.outcomes.shift() ?? success();

    if (outcome.type === "failure") {
      return Promise.reject(
        new AIProviderExecutionError({
          providerId: this.providerId,
          failureCategory: outcome.category,
          message: "Fake provider failure.",
          ...(outcome.providerStatusCode === undefined
            ? {}
            : { providerStatusCode: outcome.providerStatusCode }),
          ...(outcome.providerRequestId === undefined
            ? {}
            : { providerRequestId: outcome.providerRequestId }),
        }),
      );
    }

    if (outcome.type === "throw") {
      return Promise.reject(outcome.error);
    }

    return Promise.resolve({
      providerId: this.providerId,
      model: request.model,
      content: outcome.content ?? `${this.providerId} response`,
      finishReason: outcome.finishReason ?? "completed",
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
      requestId: `${this.providerId}-request`,
    });
  }
}

describe("AIExecutionOrchestratorService", () => {
  it("executes the primary provider", async () => {
    const provider = new FakeAIProvider("openai");

    await executeWithProviders([provider]);

    expect(provider.calls).toHaveLength(1);
  });

  it("builds the request using the primary model", async () => {
    const provider = new FakeAIProvider("openai");

    await executeWithProviders([provider], { plan: buildPlan({ primaryTarget: target("openai", "gpt-test") }) });

    expect(provider.calls[0]?.model).toBe("gpt-test");
  });

  it("passes rendered prompt messages", async () => {
    const provider = new FakeAIProvider("openai");
    const renderedPrompt = buildRenderedPrompt({
      messages: [
        { role: "system", content: "System" },
        { role: "user", content: "User" },
      ],
    });

    await executeWithProviders([provider], { renderedPrompt });

    expect(provider.calls[0]?.messages).toEqual(renderedPrompt.messages);
  });

  it("passes temperature", async () => {
    const provider = new FakeAIProvider("openai");

    await executeWithProviders([provider], {
      plan: buildPlan({ generationControls: { temperature: 0.2 } }),
    });

    expect(provider.calls[0]?.temperature).toBe(0.2);
  });

  it("preserves zero temperature", async () => {
    const provider = new FakeAIProvider("openai");

    await executeWithProviders([provider], {
      plan: buildPlan({ generationControls: { temperature: 0 } }),
    });

    expect(provider.calls[0]?.temperature).toBe(0);
  });

  it("passes max output tokens", async () => {
    const provider = new FakeAIProvider("openai");

    await executeWithProviders([provider], {
      plan: buildPlan({ generationControls: { maxOutputTokens: 128 } }),
    });

    expect(provider.calls[0]?.maxOutputTokens).toBe(128);
  });

  it("passes metadata", async () => {
    const provider = new FakeAIProvider("openai");
    const metadata: AIMetadata = { purpose: "test", batch: 1, enabled: true, nullable: null };

    await executeWithProviders([provider], { plan: buildPlan({ metadata }) });

    expect(provider.calls[0]?.metadata).toEqual(metadata);
  });

  it("returns normalized provider response", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai", [success({ content: "Done" })])]);

    expect(result.response.content).toBe("Done");
    expect(result.response.providerId).toBe("openai");
  });

  it("preserves policy ID and version", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai")]);

    expect(result.policyId).toBe("policy.test");
    expect(result.policyVersion).toBe("1.0.0");
  });

  it("returns the successful selected target", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai")]);

    expect(result.selectedTarget).toEqual(target("openai", "gpt-test"));
  });

  it("reports fallbackUsed false for primary success", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai")]);

    expect(result.fallbackUsed).toBe(false);
  });

  it("reports correct total attempts", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai")]);

    expect(result.totalAttempts).toBe(result.attempts.length);
  });

  it("records a successful attempt", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai")]);

    expect(result.attempts[0]).toEqual({
      attemptNumber: 1,
      targetAttemptNumber: 1,
      target: target("openai", "gpt-test"),
      status: "succeeded",
    });
  });

  it("resolves provider through the registry", async () => {
    const provider = new FakeAIProvider("anthropic");

    const result = await executeWithProviders([provider], {
      plan: buildPlan({ primaryTarget: target("ANTHROPIC", "claude-test") }),
    });

    expect(result.response.providerId).toBe("anthropic");
  });

  it("does not depend on concrete provider adapters", async () => {
    const fake = new FakeAIProvider("custom");

    const result = await executeWithProviders([fake], {
      plan: buildPlan({ primaryTarget: target("custom", "custom-model") }),
    });

    expect(result.selectedTarget).toEqual(target("custom", "custom-model"));
  });

  it("rejects an unknown primary provider as configuration error", async () => {
    await expect(executeWithProviders([])).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects an unknown fallback provider when reached", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);

    await expect(
      executeWithProviders([primary], {
        plan: buildPlan({ fallbackTargets: [target("missing", "missing-model")] }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("does not treat unknown provider as retryable", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);

    await expect(
      executeWithProviders([primary], {
        plan: buildPlan({
          fallbackTargets: [target("missing", "missing-model")],
          retryableFailureCategories: ["temporary_failure"],
          maxAttempts: 1,
        }),
      }),
    ).rejects.toMatchObject({ attempts: [expect.objectContaining({ status: "failed" })] });
  });

  it("preserves prior attempt trace when a later fallback provider is unknown", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);

    await expect(
      executeWithProviders([primary], {
        plan: buildPlan({ fallbackTargets: [target("missing", "missing-model")] }),
      }),
    ).rejects.toMatchObject({ attempts: [expect.objectContaining({ attemptNumber: 1 })] });
  });

  it("performs no retry when maxAttempts is 1", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure"), success()]);

    await expect(
      executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 1 }) }),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);

    expect(provider.calls).toHaveLength(1);
  });

  it("retries the same provider when failure category is retryable", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure"), success()]);

    const result = await executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) });

    expect(result.totalAttempts).toBe(2);
    expect(provider.calls).toHaveLength(2);
  });

  it("stops retrying after maxAttempts", async () => {
    const provider = new FakeAIProvider("openai", [
      failure("temporary_failure"),
      failure("temporary_failure"),
      success(),
    ]);

    await expect(
      executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) }),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);

    expect(provider.calls).toHaveLength(2);
  });

  it("records every retry attempt", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure"), success()]);
    const result = await executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) });

    expect(result.attempts).toHaveLength(2);
  });

  it("uses globally increasing attempt numbers", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure"), failure("temporary_failure")]);
    const fallback = new FakeAIProvider("google", [success()]);
    const result = await executeWithProviders([primary, fallback], {
      plan: buildPlan({ maxAttempts: 2, fallbackTargets: [target("google", "gemini-test")] }),
    });

    expect(result.attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2, 3]);
  });

  it("does not retry a non-retryable category", async () => {
    const provider = new FakeAIProvider("openai", [failure("rate_limit"), success()]);

    await expect(
      executeWithProviders([provider], {
        plan: buildPlan({ maxAttempts: 2, retryableFailureCategories: ["temporary_failure"] }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);

    expect(provider.calls).toHaveLength(1);
  });

  it("does not hard-code retry categories", async () => {
    const provider = new FakeAIProvider("openai", [failure("rate_limit"), success()]);

    const result = await executeWithProviders([provider], {
      plan: buildPlan({ maxAttempts: 2, retryableFailureCategories: ["rate_limit"] }),
    });

    expect(result.response.content).toBe("openai response");
  });

  it("supports retry when unknown is explicitly configured", async () => {
    const provider = new FakeAIProvider("openai", [failure("unknown"), success()]);

    const result = await executeWithProviders([provider], {
      plan: withRetryCategories(buildPlan({ maxAttempts: 2 }), ["unknown"]),
    });

    expect(result.totalAttempts).toBe(2);
  });

  it("does not delay between retries", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure"), success()]);

    await executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) });

    expect(provider.calls).toHaveLength(2);
  });

  it("calls provider exactly the allowed number of times", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure"), failure("temporary_failure")]);

    await expect(
      executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) }),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);

    expect(provider.calls).toHaveLength(2);
  });

  it("returns immediately after retry succeeds", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure"), success({ content: "Recovered" })]);

    const result = await executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 3 }) });

    expect(result.response.content).toBe("Recovered");
    expect(provider.calls).toHaveLength(2);
  });

  it("does not proceed to fallback after retry succeeds", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure"), success()]);
    const fallback = new FakeAIProvider("google");

    await executeWithProviders([primary, fallback], {
      plan: buildPlan({ maxAttempts: 2, fallbackTargets: [target("google", "gemini-test")] }),
    });

    expect(fallback.calls).toHaveLength(0);
  });

  const terminalCategories: readonly AIProviderFailureCategory[] = [
    "authentication",
    "permission_denied",
    "invalid_request",
    "content_filtered",
    "cancelled",
  ];

  for (const category of terminalCategories) {
    it(`stops immediately on ${category} failure`, async () => {
      const provider = new FakeAIProvider("openai", [failure(category), success()]);

      await expect(
        executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) }),
      ).rejects.toBeInstanceOf(AITerminalExecutionError);

      expect(provider.calls).toHaveLength(1);
    });
  }

  it("does not retry terminal failures even if listed as retryable", async () => {
    const provider = new FakeAIProvider("openai", [failure("authentication"), success()]);

    await expect(
      executeWithProviders([provider], {
        plan: withRetryCategories(buildPlan({ maxAttempts: 2 }), ["authentication"]),
      }),
    ).rejects.toBeInstanceOf(AITerminalExecutionError);

    expect(provider.calls).toHaveLength(1);
  });

  it("does not fallback after terminal failure", async () => {
    const primary = new FakeAIProvider("openai", [failure("authentication")]);
    const fallback = new FakeAIProvider("google");

    await expect(
      executeWithProviders([primary, fallback], {
        plan: buildPlan({ fallbackTargets: [target("google", "gemini-test")] }),
      }),
    ).rejects.toBeInstanceOf(AITerminalExecutionError);

    expect(fallback.calls).toHaveLength(0);
  });

  it("throws typed terminal execution error", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("authentication")])]),
    ).rejects.toBeInstanceOf(AITerminalExecutionError);
  });

  it("terminal error contains safe attempt trace", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("authentication")])]),
    ).rejects.toMatchObject({
      attempts: [expect.objectContaining({ status: "failed", failureCategory: "authentication" })],
    });
  });

  it("terminal error preserves provider status code", async () => {
    await expect(
      executeWithProviders([
        new FakeAIProvider("openai", [failure("authentication", { providerStatusCode: 401 })]),
      ]),
    ).rejects.toMatchObject({ providerStatusCode: 401 });
  });

  it("terminal error preserves provider request ID", async () => {
    await expect(
      executeWithProviders([
        new FakeAIProvider("openai", [failure("authentication", { providerRequestId: "req_123" })]),
      ]),
    ).rejects.toMatchObject({ providerRequestId: "req_123" });
  });

  it("terminal error does not expose raw error objects", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("authentication")])]),
    ).rejects.not.toHaveProperty("cause");
  });

  it("executes fallback after primary non-terminal exhaustion", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);
    const fallback = new FakeAIProvider("google");

    const result = await executeWithProviders([primary, fallback], {
      plan: buildPlan({ fallbackTargets: [target("google", "gemini-test")] }),
    });

    expect(result.selectedTarget).toEqual(target("google", "gemini-test"));
  });

  it("preserves fallback order", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);
    const fallbackOne = new FakeAIProvider("anthropic", [failure("temporary_failure")]);
    const fallbackTwo = new FakeAIProvider("google", [success()]);

    const result = await executeWithProviders([primary, fallbackOne, fallbackTwo], {
      plan: buildPlan({
        fallbackTargets: [target("anthropic", "claude-test"), target("google", "gemini-test")],
      }),
    });

    expect(result.selectedTarget).toEqual(target("google", "gemini-test"));
    expect(result.attempts.map((attempt) => attempt.target.providerId)).toEqual(["openai", "anthropic", "google"]);
  });

  it("does not execute fallback before primary retries are exhausted", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure"), failure("temporary_failure")]);
    const fallback = new FakeAIProvider("google", [success()]);

    const result = await executeWithProviders([primary, fallback], {
      plan: buildPlan({ maxAttempts: 2, fallbackTargets: [target("google", "gemini-test")] }),
    });

    expect(result.attempts.map((attempt) => attempt.target.providerId)).toEqual(["openai", "openai", "google"]);
  });

  it("returns immediately after first successful fallback", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);
    const fallback = new FakeAIProvider("google", [success()]);

    const result = await executeWithProviders([primary, fallback], {
      plan: buildPlan({ fallbackTargets: [target("google", "gemini-test")] }),
    });

    expect(result.response.providerId).toBe("google");
  });

  it("does not execute later fallback after success", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);
    const fallbackOne = new FakeAIProvider("anthropic", [success()]);
    const fallbackTwo = new FakeAIProvider("google", [success()]);

    await executeWithProviders([primary, fallbackOne, fallbackTwo], {
      plan: buildPlan({
        fallbackTargets: [target("anthropic", "claude-test"), target("google", "gemini-test")],
      }),
    });

    expect(fallbackTwo.calls).toHaveLength(0);
  });

  it("reports fallbackUsed true", async () => {
    const result = await fallbackSuccessResult();

    expect(result.fallbackUsed).toBe(true);
  });

  it("sets selected target to successful fallback", async () => {
    const result = await fallbackSuccessResult();

    expect(result.selectedTarget).toEqual(target("google", "gemini-test"));
  });

  it("includes primary and fallback attempts in order", async () => {
    const result = await fallbackSuccessResult();

    expect(result.attempts.map((attempt) => attempt.target.providerId)).toEqual(["openai", "google"]);
  });

  it("supports multiple fallback targets", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);
    const fallbackOne = new FakeAIProvider("anthropic", [failure("temporary_failure")]);
    const fallbackTwo = new FakeAIProvider("google", [success()]);

    const result = await executeWithProviders([primary, fallbackOne, fallbackTwo], {
      plan: buildPlan({
        fallbackTargets: [target("anthropic", "claude-test"), target("google", "gemini-test")],
      }),
    });

    expect(result.response.providerId).toBe("google");
  });

  it("supports no fallback targets", async () => {
    const provider = new FakeAIProvider("openai", [success()]);

    const result = await executeWithProviders([provider], { plan: buildPlan({ fallbackTargets: [] }) });

    expect(result.fallbackUsed).toBe(false);
  });

  it("never returns to an earlier target", async () => {
    const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);
    const fallback = new FakeAIProvider("google", [failure("temporary_failure")]);

    await expect(
      executeWithProviders([primary, fallback], {
        plan: buildPlan({ fallbackTargets: [target("google", "gemini-test")] }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);

    expect(primary.calls).toHaveLength(1);
  });

  it("does not duplicate target execution beyond configured attempts", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure")]);

    await expect(
      executeWithProviders([provider], {
        plan: buildPlan({ fallbackTargets: [target("openai", "gpt-test")] }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);

    expect(provider.calls).toHaveLength(1);
  });

  it("throws exhausted error when primary fails and no fallback exists", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("temporary_failure")])]),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);
  });

  it("throws exhausted error when all targets fail", async () => {
    await expect(
      executeWithProviders(
        [
          new FakeAIProvider("openai", [failure("temporary_failure")]),
          new FakeAIProvider("google", [failure("temporary_failure")]),
        ],
        { plan: buildPlan({ fallbackTargets: [target("google", "gemini-test")] }) },
      ),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);
  });

  it("exhausted error includes all attempt records", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("temporary_failure")])]),
    ).rejects.toMatchObject({ attempts: [expect.objectContaining({ attemptNumber: 1 })] });
  });

  it("exhausted error preserves policy ID and version", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("temporary_failure")])]),
    ).rejects.toMatchObject({ policyId: "policy.test", policyVersion: "1.0.0" });
  });

  it("exhausted error exposes last failure category", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("rate_limit")])]),
    ).rejects.toMatchObject({ lastFailureCategory: "rate_limit" });
  });

  it("exhausted error does not expose raw provider errors", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("temporary_failure")])]),
    ).rejects.not.toHaveProperty("cause");
  });

  it("attempt count equals total provider calls", async () => {
    const provider = new FakeAIProvider("openai", [failure("temporary_failure"), success()]);
    const result = await executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) });

    expect(result.totalAttempts).toBe(provider.calls.length);
  });

  it("failed attempts preserve target identity", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [failure("temporary_failure")])]),
    ).rejects.toMatchObject({
      attempts: [expect.objectContaining({ target: target("openai", "gpt-test") })],
    });
  });

  for (const finishReason of ["completed", "max_tokens", "unknown"] as const) {
    it(`treats resolved ${finishReason} as success`, async () => {
      const result = await executeWithProviders([new FakeAIProvider("openai", [success({ finishReason })])]);

      expect(result.response.finishReason).toBe(finishReason);
    });
  }

  it("treats resolved content_filtered as terminal failure", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [success({ finishReason: "content_filtered" })])]),
    ).rejects.toBeInstanceOf(AITerminalExecutionError);
  });

  it("treats resolved cancelled as terminal failure", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [success({ finishReason: "cancelled" })])]),
    ).rejects.toBeInstanceOf(AITerminalExecutionError);
  });

  it("treats resolved error as failed attempt", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [success({ finishReason: "error" })])]),
    ).rejects.toMatchObject({
      attempts: [expect.objectContaining({ status: "failed", failureCategory: "unknown" })],
    });
  });

  it("allows fallback after resolved error when permitted", async () => {
    const primary = new FakeAIProvider("openai", [success({ finishReason: "error" })]);
    const fallback = new FakeAIProvider("google", [success()]);

    const result = await executeWithProviders([primary, fallback], {
      plan: buildPlan({ fallbackTargets: [target("google", "gemini-test")] }),
    });

    expect(result.response.providerId).toBe("google");
  });

  it("does not return a result with finish reason error", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai", [success({ finishReason: "error" })])]),
    ).rejects.toBeInstanceOf(AIExecutionExhaustedError);
  });

  it("does not retry solely for max_tokens", async () => {
    const provider = new FakeAIProvider("openai", [success({ finishReason: "max_tokens" }), success()]);

    const result = await executeWithProviders([provider], { plan: buildPlan({ maxAttempts: 2 }) });

    expect(result.totalAttempts).toBe(1);
  });

  it("rejects an empty rendered message collection", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], {
        renderedPrompt: buildRenderedPrompt({ messages: [] }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects empty policy ID", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], { plan: buildPlan({ policyId: "" }) }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects empty policy version", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], { plan: buildPlan({ policyVersion: "" }) }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects empty primary provider ID", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], {
        plan: buildPlan({ primaryTarget: target("", "gpt-test") }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects empty primary model ID", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], {
        plan: buildPlan({ primaryTarget: target("openai", "") }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects invalid maxAttempts", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], { plan: buildPlan({ maxAttempts: 0 }) }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects malformed fallback target", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], {
        plan: buildPlan({ fallbackTargets: [target("google", "")] }),
      }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("rejects malformed retry category collection where structurally possible", async () => {
    await expect(
      executeWithProviders([new FakeAIProvider("openai")], {
        plan: withRetryCategories(buildPlan(), [""]),
      }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);
  });

  it("does not invoke providers for invalid input", async () => {
    const provider = new FakeAIProvider("openai");

    await expect(
      executeWithProviders([provider], { renderedPrompt: buildRenderedPrompt({ messages: [] }) }),
    ).rejects.toBeInstanceOf(AIExecutionConfigurationError);

    expect(provider.calls).toHaveLength(0);
  });

  it("does not mutate rendered prompt", async () => {
    const renderedPrompt = buildRenderedPrompt();
    const snapshot = JSON.stringify(renderedPrompt);

    await executeWithProviders([new FakeAIProvider("openai")], { renderedPrompt });

    expect(JSON.stringify(renderedPrompt)).toBe(snapshot);
  });

  it("does not mutate prompt messages", async () => {
    const messages = [{ role: "user" as const, content: "Original" }];
    const renderedPrompt = buildRenderedPrompt({ messages });

    await executeWithProviders([new FakeAIProvider("openai")], { renderedPrompt });

    expect(messages).toEqual([{ role: "user", content: "Original" }]);
  });

  it("does not mutate execution plan", async () => {
    const plan = buildPlan();
    const snapshot = JSON.stringify(plan);

    await executeWithProviders([new FakeAIProvider("openai")], { plan });

    expect(JSON.stringify(plan)).toBe(snapshot);
  });

  it("does not mutate primary target", async () => {
    const primaryTarget = target("openai", "gpt-test");

    await executeWithProviders([new FakeAIProvider("openai")], { plan: buildPlan({ primaryTarget }) });

    expect(primaryTarget).toEqual(target("openai", "gpt-test"));
  });

  it("does not mutate fallback targets", async () => {
    const fallbackTargets = [target("google", "gemini-test")];

    await fallbackSuccessResult(fallbackTargets);

    expect(fallbackTargets).toEqual([target("google", "gemini-test")]);
  });

  it("does not mutate generation controls", async () => {
    const generationControls = { temperature: 0.5, maxOutputTokens: 100 };

    await executeWithProviders([new FakeAIProvider("openai")], { plan: buildPlan({ generationControls }) });

    expect(generationControls).toEqual({ temperature: 0.5, maxOutputTokens: 100 });
  });

  it("does not mutate retry categories", async () => {
    const retryableFailureCategories: AIRetryableFailureCategory[] = ["temporary_failure"];

    await executeWithProviders([new FakeAIProvider("openai")], {
      plan: buildPlan({ retryableFailureCategories }),
    });

    expect(retryableFailureCategories).toEqual(["temporary_failure"]);
  });

  it("does not mutate metadata", async () => {
    const metadata: AIMetadata = { purpose: "immutable" };

    await executeWithProviders([new FakeAIProvider("openai")], { plan: buildPlan({ metadata }) });

    expect(metadata).toEqual({ purpose: "immutable" });
  });

  it("returned attempts cannot mutate internal execution history", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai")]);

    expect(Object.isFrozen(result.attempts)).toBe(true);
  });

  it("returned selected target is defensively copied", async () => {
    const selectedTarget = (await executeWithProviders([new FakeAIProvider("openai")])).selectedTarget;

    expect(Object.isFrozen(selectedTarget)).toBe(true);
  });

  it("contains no provider SDK imports", () => {
    const source = readServiceSource();

    expect(source).not.toContain("@google/genai");
    expect(source).not.toContain("openai");
    expect(source).not.toContain("@anthropic-ai/sdk");
  });

  it("does not require OpenAI adapter", () => {
    expect(readServiceSource()).not.toContain("openai-provider.adapter");
  });

  it("does not require Claude adapter", () => {
    expect(readServiceSource()).not.toContain("claude-provider.adapter");
  });

  it("does not require Gemini adapter", () => {
    expect(readServiceSource()).not.toContain("gemini-provider.adapter");
  });

  it("does not read environment variables", () => {
    expect(readServiceSource()).not.toContain("process.env");
  });

  it("performs no Shopify operation", () => {
    expect(readServiceSource()).not.toContain("shopify");
  });

  it("performs no AI Product Engine operation", () => {
    expect(readServiceSource()).not.toContain("ai-product");
  });

  it("contains no retry delay", () => {
    expect(readServiceSource()).not.toContain("delay");
  });

  it("contains no timer", () => {
    const source = readServiceSource();

    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("setInterval");
  });

  it("contains no concurrency", () => {
    expect(readServiceSource()).not.toContain("Promise.all");
  });

  it("works with fake providers", async () => {
    const result = await executeWithProviders([new FakeAIProvider("fake")], {
      plan: buildPlan({ primaryTarget: target("fake", "fake-model") }),
    });

    expect(result.response.providerId).toBe("fake");
  });

  it("produces a serializable execution result", async () => {
    const result = await executeWithProviders([new FakeAIProvider("openai")]);

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

function success(overrides: {
  readonly finishReason?: AIFinishReason;
  readonly content?: string;
} = {}): ProviderOutcome {
  return {
    type: "success",
    ...overrides,
  };
}

function failure(
  category: AIProviderFailureCategory,
  options: { readonly providerStatusCode?: number; readonly providerRequestId?: string } = {},
): ProviderOutcome {
  return {
    type: "failure",
    category,
    ...(options.providerStatusCode === undefined ? {} : { providerStatusCode: options.providerStatusCode }),
    ...(options.providerRequestId === undefined ? {} : { providerRequestId: options.providerRequestId }),
  };
}

async function fallbackSuccessResult(
  fallbackTargets: readonly AIExecutionTarget[] = [target("google", "gemini-test")],
): Promise<AIExecutionResult> {
  const primary = new FakeAIProvider("openai", [failure("temporary_failure")]);
  const fallback = new FakeAIProvider("google", [success()]);

  return executeWithProviders([primary, fallback], {
    plan: buildPlan({ fallbackTargets }),
  });
}

async function executeWithProviders(
  providers: readonly AIProviderPort[],
  options: {
    readonly renderedPrompt?: RenderedPrompt;
    readonly plan?: AIExecutionPlan;
  } = {},
): Promise<AIExecutionResult> {
  const registry = new AIProviderRegistryService(providers);
  const orchestrator = new AIExecutionOrchestratorService(registry);

  return orchestrator.execute(options.renderedPrompt ?? buildRenderedPrompt(), options.plan ?? buildPlan());
}

function buildRenderedPrompt(overrides: Partial<RenderedPrompt> = {}): RenderedPrompt {
  return {
    templateId: "template.test",
    templateVersion: "1.0.0",
    messages: [{ role: "user", content: "Write product copy." }],
    usedVariables: ["productName"],
    ...overrides,
  };
}

function buildPlan(overrides: Partial<AIExecutionPlan> = {}): AIExecutionPlan {
  return {
    policyId: "policy.test",
    policyVersion: "1.0.0",
    primaryTarget: target("openai", "gpt-test"),
    fallbackTargets: [],
    generationControls: {
      temperature: 0.4,
      maxOutputTokens: 256,
    },
    timeoutMs: 30_000,
    maxAttempts: 1,
    retryableFailureCategories: ["temporary_failure"],
    metadata: { requestType: "unit-test" },
    ...overrides,
  };
}

function withRetryCategories(
  plan: AIExecutionPlan,
  retryableFailureCategories: readonly string[],
): AIExecutionPlan {
  return {
    ...plan,
    retryableFailureCategories:
      retryableFailureCategories as readonly AIRetryableFailureCategory[],
  };
}

function target(providerId: AIProviderId, model: string): AIExecutionTarget {
  return {
    providerId,
    model,
  };
}

function copyRequest(request: AITextGenerationRequest): AITextGenerationRequest {
  return {
    model: request.model,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.maxOutputTokens === undefined ? {} : { maxOutputTokens: request.maxOutputTokens }),
    ...(request.metadata === undefined ? {} : { metadata: { ...request.metadata } }),
  };
}

function readServiceSource(): string {
  return readFileSync("src/ai/services/ai-execution-orchestrator.service.ts", "utf8");
}
