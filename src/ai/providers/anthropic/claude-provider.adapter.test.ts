import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  AIProviderExecutionError,
  InvalidAIProviderRequestError,
  InvalidAIProviderResponseError,
} from "../ai-provider.errors.js";
import type { AIProviderPort } from "../ai-provider.port.js";
import type { AITextGenerationRequest } from "../../types/ai-provider.types.js";
import {
  ClaudeProviderAdapter,
  type AnthropicMessagesClientDependency,
} from "./claude-provider.adapter.js";

type ClaudeRequest = Parameters<AnthropicMessagesClientDependency["messages"]["create"]>[0];
type ClaudeResponse = Awaited<
  ReturnType<AnthropicMessagesClientDependency["messages"]["create"]>
>;
type ClaudeUsage = NonNullable<ClaudeResponse["usage"]>;

class FakeAnthropicClient implements AnthropicMessagesClientDependency {
  public readonly calls: ClaudeRequest[] = [];
  private readonly handler: (request: ClaudeRequest) => Promise<ClaudeResponse>;

  public constructor(handler: (request: ClaudeRequest) => Promise<ClaudeResponse>) {
    this.handler = handler;
  }

  public readonly messages = {
    create: async (request: ClaudeRequest): Promise<ClaudeResponse> => {
      this.calls.push(request);
      return this.handler(request);
    },
  };
}

describe("ClaudeProviderAdapter", () => {
  it("exposes provider ID anthropic", () => {
    expect(createAdapter().providerId).toBe("anthropic");
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

    expect(provider.providerId).toBe("anthropic");
  });

  it("maps the requested model", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ model: "claude-test-model" }));

    expect(client.calls[0]?.model).toBe("claude-test-model");
  });

  it("maps maxOutputTokens to max_tokens", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ maxOutputTokens: 321 }));

    expect(client.calls[0]?.max_tokens).toBe(321);
  });

  it("rejects missing maxOutputTokens", async () => {
    await expect(createAdapter().generateText(buildRequestWithoutMaxTokens())).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects zero max output tokens", async () => {
    await expect(createAdapter().generateText(buildRequest({ maxOutputTokens: 0 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects negative max output tokens", async () => {
    await expect(createAdapter().generateText(buildRequest({ maxOutputTokens: -1 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects fractional max output tokens", async () => {
    await expect(createAdapter().generateText(buildRequest({ maxOutputTokens: 1.5 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects unsafe max output tokens", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ maxOutputTokens: Number.MAX_SAFE_INTEGER + 1 })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("maps one leading system message to top-level system", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "You are precise." },
          { role: "user", content: "Hello" },
        ],
      }),
    );

    expect(client.calls[0]?.system).toBe("You are precise.");
  });

  it("combines multiple leading system messages using double newlines", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "First" },
          { role: "system", content: "Second" },
          { role: "user", content: "Hello" },
        ],
      }),
    );

    expect(client.calls[0]?.system).toBe("First\n\nSecond");
  });

  it("omits top-level system when absent", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect("system" in (client.calls[0] ?? {})).toBe(false);
  });

  it("removes leading system messages from Anthropic messages", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "System" },
          { role: "user", content: "User" },
        ],
      }),
    );

    expect(client.calls[0]?.messages).toEqual([{ role: "user", content: "User" }]);
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
      createAdapter().generateText(
        buildRequest({ messages: [{ role: "system", content: "Only system" }] }),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("preserves system-message order", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "A" },
          { role: "system", content: "B" },
          { role: "system", content: "C" },
          { role: "user", content: "Prompt" },
        ],
      }),
    );

    expect(client.calls[0]?.system).toBe("A\n\nB\n\nC");
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

  it("maps one user message", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ messages: [{ role: "user", content: "Hello" }] }));

    expect(client.calls[0]?.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("maps multiple user and assistant messages", async () => {
    const { client, adapter } = createAdapterWithClient();
    const messages: AITextGenerationRequest["messages"] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Again" },
    ];

    await adapter.generateText(buildRequest({ messages }));

    expect(client.calls[0]?.messages).toEqual(messages);
  });

  it("preserves conversational order", async () => {
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

    expect(client.calls[0]?.messages.map((message) => message.content)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("preserves assistant messages", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "user", content: "Question" },
          { role: "assistant", content: "Partial" },
        ],
      }),
    );

    expect(client.calls[0]?.messages[1]).toEqual({ role: "assistant", content: "Partial" });
  });

  it("preserves content exactly", async () => {
    const { client, adapter } = createAdapterWithClient();
    const content = " Keep spacing\nand punctuation. ";

    await adapter.generateText(buildRequest({ messages: [{ role: "user", content }] }));

    expect(client.calls[0]?.messages[0]?.content).toBe(content);
  });

  it("does not merge adjacent conversational messages", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "user", content: "A" },
          { role: "user", content: "B" },
        ],
      }),
    );

    expect(client.calls[0]?.messages).toHaveLength(2);
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

  it("rejects an empty model", async () => {
    await expect(createAdapter().generateText(buildRequest({ model: "" }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects whitespace-only model", async () => {
    await expect(createAdapter().generateText(buildRequest({ model: "   " }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("maps a valid temperature", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ temperature: 0.7 }));

    expect(client.calls[0]?.temperature).toBe(0.7);
  });

  it("preserves temperature 0", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ temperature: 0 }));

    expect(client.calls[0]?.temperature).toBe(0);
  });

  it("omits temperature when undefined", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect("temperature" in (client.calls[0] ?? {})).toBe(false);
  });

  it("rejects temperature below the supported minimum", async () => {
    await expect(createAdapter().generateText(buildRequest({ temperature: -0.1 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects temperature above the supported maximum", async () => {
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

  it("does not mutate metadata", async () => {
    const { adapter } = createAdapterWithClient();
    const metadata = { purpose: "test", enabled: true };

    await adapter.generateText(buildRequest({ metadata }));

    expect(metadata).toEqual({ purpose: "test", enabled: true });
  });

  it("does not unsafely send unsupported arbitrary metadata", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ metadata: { tenant: "sireh" } }));

    expect("metadata" in (client.calls[0] ?? {})).toBe(false);
  });

  it("uses the documented Anthropic metadata policy", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ metadata: { user_id: "not-forwarded" } }));

    expect(client.calls[0]).not.toHaveProperty("metadata");
  });

  it("normalizes provider ID", async () => {
    const response = await createAdapter().generateText(buildRequest());

    expect(response.providerId).toBe("anthropic");
  });

  it("normalizes provider-reported model", async () => {
    const response = await createAdapterWithResponse(buildResponse({ model: "reported-model" })).generateText(
      buildRequest({ model: "requested-model" }),
    );

    expect(response.model).toBe("reported-model");
  });

  it("falls back to requested model when response model is absent", async () => {
    const response = await createAdapterWithResponse(buildResponseWithoutModel()).generateText(
      buildRequest({ model: "requested-model" }),
    );

    expect(response.model).toBe("requested-model");
  });

  it("extracts a single text block", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ content: [{ type: "text", text: "Hello" }] }),
    ).generateText(buildRequest());

    expect(response.content).toBe("Hello");
  });

  it("concatenates multiple text blocks in order", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world" },
        ],
      }),
    ).generateText(buildRequest());

    expect(response.content).toBe("Hello world");
  });

  it("ignores unsupported non-text blocks safely", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({
        content: [
          { type: "tool_use" },
          { type: "text", text: "Visible" },
          { type: "thinking" },
        ],
      }),
    ).generateText(buildRequest());

    expect(response.content).toBe("Visible");
  });

  it("handles no text blocks using the documented deterministic policy", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ content: [{ type: "tool_use" }] }),
    ).generateText(buildRequest());

    expect(response.content).toBe("");
  });

  it("maps _request_id to requestId", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ _request_id: "req_custom" }),
    ).generateText(buildRequest());

    expect(response.requestId).toBe("req_custom");
  });

  it("omits requestId when _request_id is absent", async () => {
    const response = await createAdapterWithResponse(buildResponseWithoutRequestId()).generateText(
      buildRequest(),
    );

    expect("requestId" in response).toBe(false);
  });

  it("does not expose raw response blocks", async () => {
    const response = await createAdapter().generateText(buildRequest());

    expect("contentBlocks" in response).toBe(false);
    expect("content" in response).toBe(true);
    expect("raw" in response).toBe(false);
  });

  it("rejects an unusable provider response ID", async () => {
    await expect(createAdapterWithResponse(buildResponse({ id: "" })).generateText(buildRequest())).rejects.toBeInstanceOf(
      InvalidAIProviderResponseError,
    );
  });

  it("maps input tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.inputTokens).toBe(13);
  });

  it("maps output tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.outputTokens).toBe(8);
  });

  it("calculates total tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.totalTokens).toBe(21);
  });

  it("uses zero usage when usage is legitimately absent", async () => {
    const response = await createAdapterWithResponse(buildResponseWithoutUsage()).generateText(buildRequest());

    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("rejects negative input tokens", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usage: usage({ input_tokens: -1 }) })).generateText(buildRequest()),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects negative output tokens", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usage: usage({ output_tokens: -1 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects fractional usage", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usage: usage({ input_tokens: 1.5 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects unsafe usage", async () => {
    await expect(
      createAdapterWithResponse(
        buildResponse({ usage: usage({ output_tokens: Number.MAX_SAFE_INTEGER + 1 }) }),
      ).generateText(buildRequest()),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("maps end_turn to completed", async () => {
    expect((await createAdapterWithStopReason("end_turn").generateText(buildRequest())).finishReason).toBe(
      "completed",
    );
  });

  it("maps stop_sequence to completed", async () => {
    expect((await createAdapterWithStopReason("stop_sequence").generateText(buildRequest())).finishReason).toBe(
      "completed",
    );
  });

  it("maps max_tokens to max_tokens", async () => {
    expect((await createAdapterWithStopReason("max_tokens").generateText(buildRequest())).finishReason).toBe(
      "max_tokens",
    );
  });

  it("maps refusal to content_filtered", async () => {
    expect((await createAdapterWithStopReason("refusal").generateText(buildRequest())).finishReason).toBe(
      "content_filtered",
    );
  });

  it("maps pause_turn to unknown", async () => {
    expect((await createAdapterWithStopReason("pause_turn").generateText(buildRequest())).finishReason).toBe(
      "unknown",
    );
  });

  it("maps tool_use to unknown", async () => {
    expect((await createAdapterWithStopReason("tool_use").generateText(buildRequest())).finishReason).toBe(
      "unknown",
    );
  });

  it("maps null stop reason to unknown", async () => {
    expect((await createAdapterWithStopReason(null).generateText(buildRequest())).finishReason).toBe("unknown");
  });

  it("maps unrecognized stop reason to unknown", async () => {
    expect((await createAdapterWithStopReason("unexpected").generateText(buildRequest())).finishReason).toBe(
      "unknown",
    );
  });

  it("translates 400 to invalid_request", async () => {
    await expectFailureCategory(anthropicError(statusError(400)), "invalid_request");
  });

  it("translates 401 to authentication", async () => {
    await expectFailureCategory(anthropicError(statusError(401)), "authentication");
  });

  it("translates 402 to permission_denied", async () => {
    await expectFailureCategory(anthropicError(statusError(402)), "permission_denied");
  });

  it("translates 403 to permission_denied", async () => {
    await expectFailureCategory(anthropicError(statusError(403)), "permission_denied");
  });

  it("translates 404 to invalid_request", async () => {
    await expectFailureCategory(anthropicError(statusError(404)), "invalid_request");
  });

  it("translates 409 to temporary_failure", async () => {
    await expectFailureCategory(anthropicError(statusError(409)), "temporary_failure");
  });

  it("translates 413 to invalid_request", async () => {
    await expectFailureCategory(anthropicError(statusError(413)), "invalid_request");
  });

  it("translates 429 to rate_limit", async () => {
    await expectFailureCategory(anthropicError(statusError(429)), "rate_limit");
  });

  it("translates 500 to temporary_failure", async () => {
    await expectFailureCategory(anthropicError(statusError(500)), "temporary_failure");
  });

  it("translates 502 to provider_unavailable", async () => {
    await expectFailureCategory(anthropicError(statusError(502)), "provider_unavailable");
  });

  it("translates 503 to provider_unavailable", async () => {
    await expectFailureCategory(anthropicError(statusError(503)), "provider_unavailable");
  });

  it("translates 504 to timeout", async () => {
    await expectFailureCategory(anthropicError(statusError(504)), "timeout");
  });

  it("translates 529 to provider_unavailable", async () => {
    await expectFailureCategory(anthropicError(statusError(529)), "provider_unavailable");
  });

  it("translates connection failures safely", async () => {
    await expectFailureCategory(
      anthropicError(new APIConnectionError({ message: "connection failed" })),
      "temporary_failure",
    );
  });

  it("translates timeout connection failures safely", async () => {
    await expectFailureCategory(anthropicError(new APIConnectionTimeoutError()), "timeout");
  });

  it("translates an unknown Error", async () => {
    await expectFailureCategory(anthropicError(new Error("unknown failure")), "unknown");
  });

  it("translates a non-Error thrown value", async () => {
    await expectFailureCategory(anthropicError("boom"), "unknown");
  });

  it("preserves a safe provider status code", async () => {
    const error = await captureProviderError(anthropicError(statusError(429)));

    expect(error.providerStatusCode).toBe(429);
  });

  it("preserves a safe provider request ID", async () => {
    const error = await captureProviderError(anthropicError(statusError(429, "req_custom")));

    expect(error.providerRequestId).toBe("req_custom");
  });

  it("does not expose secrets in the public error message", async () => {
    const error = await captureProviderError(anthropicError(statusError(401, "req_test", "secret sk-test")));

    expect(error.message).not.toContain("sk-test");
  });

  it("calls messages.create exactly once", async () => {
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
    const request = buildRequest({
      metadata: { purpose: "test" },
      messages: [{ role: "user", content: "Hello" }],
    });
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

  it("does not mutate source metadata", async () => {
    const { adapter } = createAdapterWithClient();
    const metadata = { purpose: "test" };

    await adapter.generateText(buildRequest({ metadata }));

    expect(metadata).toEqual({ purpose: "test" });
  });

  it("does not require AIProviderRegistryService", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({
      providerId: "anthropic",
    });
  });

  it("does not require AIExecutionPolicyService", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({
      model: "test-model",
    });
  });

  it("does not read environment variables", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({
      providerId: "anthropic",
    });
  });

  it("performs no Shopify operation", async () => {
    const shopifyOperation = vi.fn();

    await createAdapter().generateText(buildRequest());

    expect(shopifyOperation).not.toHaveBeenCalled();
  });

  it("works using an injected fake client", async () => {
    const { adapter } = createAdapterWithClient();

    await expect(adapter.generateText(buildRequest())).resolves.toMatchObject({
      providerId: "anthropic",
      content: "Claude response",
    });
  });

  it("produces a serializable normalized response", async () => {
    const response = await createAdapter().generateText(buildRequest());

    expect(() => JSON.stringify(response)).not.toThrow();
  });
});

function createAdapter(): ClaudeProviderAdapter {
  return createAdapterWithResponse(buildResponse());
}

function createAdapterWithResponse(response: ClaudeResponse): ClaudeProviderAdapter {
  return createAdapterWithClient(() => Promise.resolve(response)).adapter;
}

function createAdapterWithStopReason(stopReason: ClaudeResponse["stop_reason"]): ClaudeProviderAdapter {
  return createAdapterWithResponse(buildResponse({ stop_reason: stopReason }));
}

function createAdapterWithClient(
  handler: (request: ClaudeRequest) => Promise<ClaudeResponse> = () => Promise.resolve(buildResponse()),
): { readonly client: FakeAnthropicClient; readonly adapter: ClaudeProviderAdapter } {
  const client = new FakeAnthropicClient(handler);
  return {
    client,
    adapter: new ClaudeProviderAdapter(client),
  };
}

function anthropicError(error: unknown): ClaudeProviderAdapter {
  return createAdapterWithClient(() => {
    throw error;
  }).adapter;
}

async function expectFailureCategory(
  adapter: ClaudeProviderAdapter,
  failureCategory: AIProviderExecutionError["failureCategory"],
): Promise<void> {
  const error = await captureProviderError(adapter);

  expect(error.failureCategory).toBe(failureCategory);
}

async function captureProviderError(adapter: ClaudeProviderAdapter): Promise<AIProviderExecutionError> {
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

function buildResponse(overrides: Partial<ClaudeResponse> = {}): ClaudeResponse {
  return {
    id: "msg_test",
    model: "test-model",
    content: [{ type: "text", text: "Claude response" }],
    stop_reason: "end_turn",
    usage: usage(),
    _request_id: "req_test",
    ...overrides,
  };
}

function buildResponseWithoutModel(overrides: Partial<ClaudeResponse> = {}): ClaudeResponse {
  return {
    id: "msg_test",
    content: [{ type: "text", text: "Claude response" }],
    stop_reason: "end_turn",
    usage: usage(),
    _request_id: "req_test",
    ...overrides,
  };
}

function buildResponseWithoutUsage(overrides: Partial<ClaudeResponse> = {}): ClaudeResponse {
  return {
    id: "msg_test",
    model: "test-model",
    content: [{ type: "text", text: "Claude response" }],
    stop_reason: "end_turn",
    _request_id: "req_test",
    ...overrides,
  };
}

function buildResponseWithoutRequestId(overrides: Partial<ClaudeResponse> = {}): ClaudeResponse {
  return {
    id: "msg_test",
    model: "test-model",
    content: [{ type: "text", text: "Claude response" }],
    stop_reason: "end_turn",
    usage: usage(),
    ...overrides,
  };
}

function usage(overrides: Partial<ClaudeUsage> = {}): ClaudeUsage {
  return {
    input_tokens: 13,
    output_tokens: 8,
    ...overrides,
  };
}

function statusError(status: number, requestId = "req_test", message = "provider failure"): APIError {
  return APIError.generate(status, { type: "api_error" }, message, headers(requestId));
}

function headers(requestId: string): Headers {
  return new Headers({ "request-id": requestId });
}
