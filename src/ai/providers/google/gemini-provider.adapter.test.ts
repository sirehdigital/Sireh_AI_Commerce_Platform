import { ApiError } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import {
  AIProviderExecutionError,
  InvalidAIProviderRequestError,
  InvalidAIProviderResponseError,
} from "../ai-provider.errors.js";
import type { AIProviderPort } from "../ai-provider.port.js";
import type { AITextGenerationRequest } from "../../types/ai-provider.types.js";
import {
  GeminiProviderAdapter,
  type GeminiClientDependency,
} from "./gemini-provider.adapter.js";

type GeminiRequest = Parameters<GeminiClientDependency["models"]["generateContent"]>[0];
type GeminiResponse = Awaited<ReturnType<GeminiClientDependency["models"]["generateContent"]>>;
type GeminiUsage = NonNullable<GeminiResponse["usageMetadata"]>;

class FakeGeminiClient implements GeminiClientDependency {
  public readonly calls: GeminiRequest[] = [];
  private readonly handler: (request: GeminiRequest) => Promise<GeminiResponse>;

  public constructor(handler: (request: GeminiRequest) => Promise<GeminiResponse>) {
    this.handler = handler;
  }

  public readonly models = {
    generateContent: async (request: GeminiRequest): Promise<GeminiResponse> => {
      this.calls.push(request);
      return this.handler(request);
    },
  };
}

describe("GeminiProviderAdapter", () => {
  it("exposes provider ID google", () => {
    expect(createAdapter().providerId).toBe("google");
  });

  it("exposes text-generation capability", () => {
    expect(createAdapter().capabilities.textGeneration).toBe(true);
  });

  it("exposes system-message support", () => {
    expect(createAdapter().capabilities.systemMessages).toBe(true);
  });

  it("exposes temperature control", () => {
    expect(createAdapter().capabilities.temperatureControl).toBe(true);
  });

  it("exposes max-output-token control", () => {
    expect(createAdapter().capabilities.maxOutputTokensControl).toBe(true);
  });

  it("implements AIProviderPort", () => {
    const provider: AIProviderPort = createAdapter();

    expect(provider.providerId).toBe("google");
  });

  it("maps the requested model", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ model: "gemini-test-model" }));

    expect(client.calls[0]?.model).toBe("gemini-test-model");
  });

  it("rejects empty model", async () => {
    await expect(createAdapter().generateText(buildRequest({ model: "" }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects whitespace-only model", async () => {
    await expect(createAdapter().generateText(buildRequest({ model: "   " }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("does not replace the requested model", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ model: "models/custom-model" }));

    expect(client.calls[0]?.model).toBe("models/custom-model");
  });

  it("maps one leading system message", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "System" },
          { role: "user", content: "User" },
        ],
      }),
    );

    expect(client.calls[0]?.config?.systemInstruction).toBe("System");
  });

  it("combines multiple leading system messages with double newlines", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "A" },
          { role: "system", content: "B" },
          { role: "user", content: "Prompt" },
        ],
      }),
    );

    expect(client.calls[0]?.config?.systemInstruction).toBe("A\n\nB");
  });

  it("omits system instruction when absent", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect(client.calls[0]?.config?.systemInstruction).toBeUndefined();
  });

  it("removes leading system messages from contents", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "System" },
          { role: "user", content: "User" },
        ],
      }),
    );

    expect(client.calls[0]?.contents).toEqual([{ role: "user", parts: [{ text: "User" }] }]);
  });

  it("rejects a system message after a user message", async () => {
    await expect(
      createAdapter().generateText(
        buildRequest({
          messages: [
            { role: "user", content: "User" },
            { role: "system", content: "System" },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("rejects a system message after an assistant message", async () => {
    await expect(
      createAdapter().generateText(
        buildRequest({
          messages: [
            { role: "assistant", content: "Assistant" },
            { role: "system", content: "System" },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("rejects a system-only request", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ messages: [{ role: "system", content: "Only" }] })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("preserves system-message order", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "First" },
          { role: "system", content: "Second" },
          { role: "system", content: "Third" },
          { role: "user", content: "Prompt" },
        ],
      }),
    );

    expect(client.calls[0]?.config?.systemInstruction).toBe("First\n\nSecond\n\nThird");
  });

  it("does not mutate source messages during system mapping", async () => {
    const { adapter } = createAdapterWithClient();
    const messages: AITextGenerationRequest["messages"] = [
      { role: "system", content: "System" },
      { role: "user", content: "User" },
    ];

    await adapter.generateText(buildRequest({ messages }));

    expect(messages).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "User" },
    ]);
  });

  it("maps user to Gemini user", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ messages: [{ role: "user", content: "Hello" }] }));

    expect(client.calls[0]?.contents[0]?.role).toBe("user");
  });

  it("maps assistant to Gemini model", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ],
      }),
    );

    expect(client.calls[0]?.contents[1]?.role).toBe("model");
  });

  it("maps one user message", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ messages: [{ role: "user", content: "Hello" }] }));

    expect(client.calls[0]?.contents).toEqual([{ role: "user", parts: [{ text: "Hello" }] }]);
  });

  it("maps multi-turn user and assistant messages", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "user", content: "One" },
          { role: "assistant", content: "Two" },
          { role: "user", content: "Three" },
        ],
      }),
    );

    expect(client.calls[0]?.contents.map((content) => content.role)).toEqual(["user", "model", "user"]);
  });

  it("preserves turn order", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "user", content: "One" },
          { role: "assistant", content: "Two" },
          { role: "user", content: "Three" },
        ],
      }),
    );

    expect(client.calls[0]?.contents.map((content) => content.parts[0]?.text)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("preserves content exactly", async () => {
    const { client, adapter } = createAdapterWithClient();
    const content = " Keep spacing\nand punctuation. ";

    await adapter.generateText(buildRequest({ messages: [{ role: "user", content }] }));

    expect(client.calls[0]?.contents[0]?.parts[0]?.text).toBe(content);
  });

  it("uses text-only parts", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect(client.calls[0]?.contents[0]?.parts).toEqual([{ text: "Hello" }]);
  });

  it("does not merge adjacent messages", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "user", content: "A" },
          { role: "user", content: "B" },
        ],
      }),
    );

    expect(client.calls[0]?.contents).toHaveLength(2);
  });

  it("rejects an empty normalized message collection", async () => {
    await expect(createAdapter().generateText(buildRequest({ messages: [] }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects empty message content", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ messages: [{ role: "user", content: "" }] })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("rejects whitespace-only message content", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ messages: [{ role: "user", content: "   " }] })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("maps valid temperature", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ temperature: 0.7 }));

    expect(client.calls[0]?.config?.temperature).toBe(0.7);
  });

  it("preserves temperature 0", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ temperature: 0 }));

    expect(client.calls[0]?.config?.temperature).toBe(0);
  });

  it("omits temperature when undefined", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect(client.calls[0]?.config?.temperature).toBeUndefined();
  });

  it("rejects temperature below minimum", async () => {
    await expect(createAdapter().generateText(buildRequest({ temperature: -0.1 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects temperature above enforced maximum", async () => {
    await expect(createAdapter().generateText(buildRequest({ temperature: 2.1 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects NaN", async () => {
    await expect(createAdapter().generateText(buildRequest({ temperature: Number.NaN }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects positive infinity", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ temperature: Number.POSITIVE_INFINITY })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("rejects negative infinity", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ temperature: Number.NEGATIVE_INFINITY })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("maps maxOutputTokens", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ maxOutputTokens: 300 }));

    expect(client.calls[0]?.config?.maxOutputTokens).toBe(300);
  });

  it("omits maxOutputTokens when undefined", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequestWithoutMaxTokens());

    expect(client.calls[0]?.config?.maxOutputTokens).toBeUndefined();
  });

  it("rejects zero maxOutputTokens", async () => {
    await expect(createAdapter().generateText(buildRequest({ maxOutputTokens: 0 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects negative maxOutputTokens", async () => {
    await expect(createAdapter().generateText(buildRequest({ maxOutputTokens: -1 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects fractional maxOutputTokens", async () => {
    await expect(createAdapter().generateText(buildRequest({ maxOutputTokens: 1.5 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects unsafe maxOutputTokens", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ maxOutputTokens: Number.MAX_SAFE_INTEGER + 1 })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("does not mutate source metadata", async () => {
    const { adapter } = createAdapterWithClient();
    const metadata = { tenant: "sireh", enabled: true };

    await adapter.generateText(buildRequest({ metadata }));

    expect(metadata).toEqual({ tenant: "sireh", enabled: true });
  });

  it("does not cast arbitrary metadata into unrelated SDK fields", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ metadata: { tenant: "sireh" } }));

    expect(client.calls[0]).not.toHaveProperty("labels");
  });

  it("uses the documented Gemini metadata policy", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ metadata: { user_id: "not-forwarded" } }));

    expect(JSON.stringify(client.calls[0])).not.toContain("not-forwarded");
  });

  it("does not add unsupported request-level storage controls", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect(client.calls[0]).not.toHaveProperty("store");
  });

  it("normalizes provider ID", async () => {
    expect((await createAdapter().generateText(buildRequest())).providerId).toBe("google");
  });

  it("uses provider-reported model when available", async () => {
    const response = await createAdapterWithResponse(buildResponse({ modelVersion: "gemini-reported" })).generateText(
      buildRequest({ model: "gemini-requested" }),
    );

    expect(response.model).toBe("gemini-reported");
  });

  it("falls back to requested model when legitimately absent", async () => {
    const response = await createAdapterWithResponse(buildResponseWithoutModel()).generateText(
      buildRequest({ model: "gemini-requested" }),
    );

    expect(response.model).toBe("gemini-requested");
  });

  it("extracts one text part", async () => {
    const response = await createAdapterWithResponse(responseWithParts([{ text: "Hello" }])).generateText(
      buildRequest(),
    );

    expect(response.content).toBe("Hello");
  });

  it("concatenates multiple text parts in order", async () => {
    const response = await createAdapterWithResponse(
      responseWithParts([{ text: "Hello " }, { text: "world" }]),
    ).generateText(buildRequest());

    expect(response.content).toBe("Hello world");
  });

  it("uses the first candidate deterministically", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({
        candidates: [
          { content: { parts: [{ text: "first" }] }, finishReason: "STOP" },
          { content: { parts: [{ text: "second" }] }, finishReason: "STOP" },
        ],
      }),
    ).generateText(buildRequest());

    expect(response.content).toBe("first");
  });

  it("ignores unsupported non-text parts", async () => {
    const response = await createAdapterWithResponse(
      responseWithParts([{ functionCall: { name: "tool" } }, { text: "Visible" }]),
    ).generateText(buildRequest());

    expect(response.content).toBe("Visible");
  });

  it("returns empty content for a valid no-text response", async () => {
    const response = await createAdapterWithResponse(responseWithParts([{ functionCall: { name: "tool" } }])).generateText(
      buildRequest(),
    );

    expect(response.content).toBe("");
  });

  it("returns empty content when there are no candidates", async () => {
    const response = await createAdapterWithResponse(buildResponse({ candidates: [] })).generateText(buildRequest());

    expect(response.content).toBe("");
  });

  it("maps response identifier when available", async () => {
    const response = await createAdapterWithResponse(buildResponse({ responseId: "resp_custom" })).generateText(
      buildRequest(),
    );

    expect(response.requestId).toBe("resp_custom");
  });

  it("omits requestId when response identifier is absent", async () => {
    const response = await createAdapterWithResponse(buildResponseWithoutResponseId()).generateText(buildRequest());

    expect("requestId" in response).toBe(false);
  });

  it("does not expose candidates or raw parts", async () => {
    const response = await createAdapter().generateText(buildRequest());

    expect("candidates" in response).toBe(false);
    expect("parts" in response).toBe(false);
    expect("raw" in response).toBe(false);
  });

  it("maps prompt tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.inputTokens).toBe(11);
  });

  it("maps candidate output tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.outputTokens).toBe(7);
  });

  it("maps provider total token count", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.totalTokens).toBe(18);
  });

  it("calculates total when provider total is missing", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 4 } }),
    ).generateText(buildRequest());

    expect(response.usage.totalTokens).toBe(9);
  });

  it("uses responseTokenCount as output token fallback", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ usageMetadata: { promptTokenCount: 5, responseTokenCount: 4 } }),
    ).generateText(buildRequest());

    expect(response.usage).toEqual({ inputTokens: 5, outputTokens: 4, totalTokens: 9 });
  });

  it("uses zero usage when usage metadata is absent", async () => {
    const response = await createAdapterWithResponse(buildResponseWithoutUsage()).generateText(buildRequest());

    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("rejects negative input tokens", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usageMetadata: usage({ promptTokenCount: -1 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects negative output tokens", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usageMetadata: usage({ candidatesTokenCount: -1 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects negative total tokens", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usageMetadata: usage({ totalTokenCount: -1 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects fractional usage", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usageMetadata: usage({ promptTokenCount: 1.5 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects unsafe usage", async () => {
    await expect(
      createAdapterWithResponse(
        buildResponse({ usageMetadata: usage({ totalTokenCount: Number.MAX_SAFE_INTEGER + 1 }) }),
      ).generateText(buildRequest()),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("maps STOP to completed", async () => {
    expect((await createAdapterWithFinishReason("STOP").generateText(buildRequest())).finishReason).toBe(
      "completed",
    );
  });

  it("maps MAX_TOKENS to max_tokens", async () => {
    expect((await createAdapterWithFinishReason("MAX_TOKENS").generateText(buildRequest())).finishReason).toBe(
      "max_tokens",
    );
  });

  it("maps SAFETY to content_filtered", async () => {
    expect((await createAdapterWithFinishReason("SAFETY").generateText(buildRequest())).finishReason).toBe(
      "content_filtered",
    );
  });

  it("maps RECITATION to content_filtered", async () => {
    expect((await createAdapterWithFinishReason("RECITATION").generateText(buildRequest())).finishReason).toBe(
      "content_filtered",
    );
  });

  it("maps other blocking reasons to content_filtered", async () => {
    for (const reason of ["LANGUAGE", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]) {
      expect((await createAdapterWithFinishReason(reason).generateText(buildRequest())).finishReason).toBe(
        "content_filtered",
      );
    }
  });

  it("maps malformed tool or function reasons to error", async () => {
    for (const reason of ["MALFORMED_FUNCTION_CALL", "UNEXPECTED_TOOL_CALL", "NO_IMAGE", "IMAGE_OTHER"]) {
      expect((await createAdapterWithFinishReason(reason).generateText(buildRequest())).finishReason).toBe(
        "error",
      );
    }
  });

  it("maps unspecified reason to unknown", async () => {
    expect(
      (await createAdapterWithFinishReason("FINISH_REASON_UNSPECIFIED").generateText(buildRequest())).finishReason,
    ).toBe("unknown");
  });

  it("maps unknown reason to unknown", async () => {
    expect((await createAdapterWithFinishReason("UNEXPECTED").generateText(buildRequest())).finishReason).toBe(
      "unknown",
    );
  });

  it("handles missing candidate finish reason", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ candidates: [{ content: { parts: [{ text: "Hello" }] } }] }),
    ).generateText(buildRequest());

    expect(response.finishReason).toBe("unknown");
  });

  it("handles prompt-level blocking as content_filtered", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ candidates: [], promptFeedback: { blockReason: "SAFETY" } }),
    ).generateText(buildRequest());

    expect(response.finishReason).toBe("content_filtered");
  });

  it("translates 400 to invalid_request", async () => {
    await expectFailureCategory(geminiError(statusError(400)), "invalid_request");
  });

  it("translates 401 to authentication", async () => {
    await expectFailureCategory(geminiError(statusError(401)), "authentication");
  });

  it("translates 403 to permission_denied", async () => {
    await expectFailureCategory(geminiError(statusError(403)), "permission_denied");
  });

  it("translates 404 to invalid_request", async () => {
    await expectFailureCategory(geminiError(statusError(404)), "invalid_request");
  });

  it("translates 408 to timeout", async () => {
    await expectFailureCategory(geminiError(statusError(408)), "timeout");
  });

  it("translates 409 to temporary_failure", async () => {
    await expectFailureCategory(geminiError(statusError(409)), "temporary_failure");
  });

  it("translates 413 to invalid_request", async () => {
    await expectFailureCategory(geminiError(statusError(413)), "invalid_request");
  });

  it("translates 429 to rate_limit", async () => {
    await expectFailureCategory(geminiError(statusError(429)), "rate_limit");
  });

  it("translates 499 to cancelled", async () => {
    await expectFailureCategory(geminiError(statusError(499)), "cancelled");
  });

  it("translates 500 to temporary_failure", async () => {
    await expectFailureCategory(geminiError(statusError(500)), "temporary_failure");
  });

  it("translates 502 to provider_unavailable", async () => {
    await expectFailureCategory(geminiError(statusError(502)), "provider_unavailable");
  });

  it("translates 503 to provider_unavailable", async () => {
    await expectFailureCategory(geminiError(statusError(503)), "provider_unavailable");
  });

  it("translates 504 to timeout", async () => {
    await expectFailureCategory(geminiError(statusError(504)), "timeout");
  });

  it("translates connection failures safely", async () => {
    await expectFailureCategory(geminiError(new TypeError("network failed")), "temporary_failure");
  });

  it("translates unknown Error instances", async () => {
    await expectFailureCategory(geminiError(new Error("unknown")), "unknown");
  });

  it("translates non-Error thrown values", async () => {
    await expectFailureCategory(geminiError("boom"), "unknown");
  });

  it("preserves safe provider status code", async () => {
    const error = await captureProviderError(geminiError(statusError(429)));

    expect(error.providerStatusCode).toBe(429);
  });

  it("does not expose secrets in public messages", async () => {
    const error = await captureProviderError(geminiError(statusError(401, "secret sk-test")));

    expect(error.message).not.toContain("sk-test");
  });

  it("calls models.generateContent exactly once", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect(client.calls).toHaveLength(1);
  });

  it("contains no retry loop", async () => {
    const { client, adapter } = createAdapterWithClient(() => {
      throw new Error("fail");
    });

    await expect(adapter.generateText(buildRequest())).rejects.toBeInstanceOf(AIProviderExecutionError);
    expect(client.calls).toHaveLength(1);
  });

  it("does not mutate the source request", async () => {
    const { adapter } = createAdapterWithClient();
    const request = buildRequest({ metadata: { purpose: "test" } });
    const before = JSON.stringify(request);

    await adapter.generateText(request);

    expect(JSON.stringify(request)).toBe(before);
  });

  it("does not mutate source messages", async () => {
    const { adapter } = createAdapterWithClient();
    const messages: AITextGenerationRequest["messages"] = [{ role: "user", content: "Hello" }];

    await adapter.generateText(buildRequest({ messages }));

    expect(messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("does not require AIProviderRegistryService", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({ providerId: "google" });
  });

  it("does not require AIExecutionPolicyService", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({ model: "test-model" });
  });

  it("does not read environment variables", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({ providerId: "google" });
  });

  it("performs no Shopify operation", async () => {
    const shopifyOperation = vi.fn();

    await createAdapter().generateText(buildRequest());

    expect(shopifyOperation).not.toHaveBeenCalled();
  });

  it("works with an injected fake client", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({
      providerId: "google",
      content: "Gemini response",
    });
  });

  it("produces a serializable normalized response", async () => {
    const response = await createAdapter().generateText(buildRequest());

    expect(() => JSON.stringify(response)).not.toThrow();
  });
});

function createAdapter(): GeminiProviderAdapter {
  return createAdapterWithResponse(buildResponse());
}

function createAdapterWithResponse(response: GeminiResponse): GeminiProviderAdapter {
  return createAdapterWithClient(() => Promise.resolve(response)).adapter;
}

function createAdapterWithFinishReason(finishReason: string): GeminiProviderAdapter {
  return createAdapterWithResponse(buildResponse({ candidates: [{ ...firstCandidate(), finishReason }] }));
}

function createAdapterWithClient(
  handler: (request: GeminiRequest) => Promise<GeminiResponse> = () => Promise.resolve(buildResponse()),
): { readonly client: FakeGeminiClient; readonly adapter: GeminiProviderAdapter } {
  const client = new FakeGeminiClient(handler);
  return {
    client,
    adapter: new GeminiProviderAdapter(client),
  };
}

function geminiError(error: unknown): GeminiProviderAdapter {
  return createAdapterWithClient(() => {
    throw error;
  }).adapter;
}

async function expectFailureCategory(
  adapter: GeminiProviderAdapter,
  failureCategory: AIProviderExecutionError["failureCategory"],
): Promise<void> {
  const error = await captureProviderError(adapter);

  expect(error.failureCategory).toBe(failureCategory);
}

async function captureProviderError(adapter: GeminiProviderAdapter): Promise<AIProviderExecutionError> {
  try {
    await adapter.generateText(buildRequest());
    throw new Error("Expected adapter to throw.");
  } catch (error) {
    if (error instanceof AIProviderExecutionError) {
      return error;
    }

    throw error;
  }
}

function buildRequest(overrides: Partial<AITextGenerationRequest> = {}): AITextGenerationRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "Hello" }],
    maxOutputTokens: 200,
    ...overrides,
  };
}

function buildRequestWithoutMaxTokens(): AITextGenerationRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "Hello" }],
  };
}

function buildResponse(overrides: Partial<GeminiResponse> = {}): GeminiResponse {
  return {
    modelVersion: "test-model",
    candidates: [firstCandidate()],
    responseId: "resp_test",
    usageMetadata: usage(),
    ...overrides,
  };
}

function buildResponseWithoutModel(overrides: Partial<GeminiResponse> = {}): GeminiResponse {
  return {
    candidates: [firstCandidate()],
    responseId: "resp_test",
    usageMetadata: usage(),
    ...overrides,
  };
}

function buildResponseWithoutResponseId(overrides: Partial<GeminiResponse> = {}): GeminiResponse {
  return {
    modelVersion: "test-model",
    candidates: [firstCandidate()],
    usageMetadata: usage(),
    ...overrides,
  };
}

function buildResponseWithoutUsage(overrides: Partial<GeminiResponse> = {}): GeminiResponse {
  return {
    modelVersion: "test-model",
    candidates: [firstCandidate()],
    responseId: "resp_test",
    ...overrides,
  };
}

type GeminiTestCandidate = NonNullable<GeminiResponse["candidates"]>[number];
type GeminiTestContent = NonNullable<GeminiTestCandidate["content"]>;
type GeminiTestPart = NonNullable<GeminiTestContent["parts"]>[number];

function responseWithParts(parts: readonly GeminiTestPart[]): GeminiResponse {
  return buildResponse({ candidates: [{ content: { parts }, finishReason: "STOP" }] });
}

function firstCandidate(): GeminiTestCandidate {
  return {
    content: {
      parts: [{ text: "Gemini response" }],
    },
    finishReason: "STOP",
  };
}

function usage(overrides: Partial<GeminiUsage> = {}): GeminiUsage {
  return {
    promptTokenCount: 11,
    candidatesTokenCount: 7,
    totalTokenCount: 18,
    ...overrides,
  };
}

function statusError(status: number, message = "provider failure"): ApiError {
  return new ApiError({ status, message });
}
