import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  AIProviderExecutionError,
  InvalidAIProviderRequestError,
  InvalidAIProviderResponseError,
} from "../ai-provider.errors.js";
import type { AIProviderPort } from "../ai-provider.port.js";
import type { AITextGenerationRequest } from "../../types/ai-provider.types.js";
import {
  OpenAIProviderAdapter,
  type OpenAIResponsesClientDependency,
} from "./openai-provider.adapter.js";

type OpenAIRequest = Parameters<OpenAIResponsesClientDependency["responses"]["create"]>[0];
type OpenAIResponse = Awaited<ReturnType<OpenAIResponsesClientDependency["responses"]["create"]>>;

class FakeOpenAIClient implements OpenAIResponsesClientDependency {
  public readonly calls: OpenAIRequest[] = [];
  private readonly handler: (request: OpenAIRequest) => Promise<OpenAIResponse>;

  public constructor(handler: (request: OpenAIRequest) => Promise<OpenAIResponse>) {
    this.handler = handler;
  }

  public readonly responses = {
    create: async (request: OpenAIRequest): Promise<OpenAIResponse> => {
      this.calls.push(request);
      return this.handler(request);
    },
  };
}

describe("OpenAIProviderAdapter", () => {
  it("exposes provider ID openai", () => {
    expect(createAdapter().providerId).toBe("openai");
  });

  it("implements the expected capabilities", () => {
    expect(createAdapter().capabilities).toEqual({
      textGeneration: true,
      systemMessages: true,
      temperatureControl: true,
      maxOutputTokensControl: true,
    });
  });

  it("implements AIProviderPort", () => {
    const provider: AIProviderPort = createAdapter();

    expect(provider.providerId).toBe("openai");
  });

  it("maps the requested model", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ model: "requested-model" }));

    expect(client.calls[0]?.model).toBe("requested-model");
  });

  it("preserves a single user message", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ messages: [{ role: "user", content: "Hello" }] }));

    expect(client.calls[0]?.input).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("preserves multiple message order", async () => {
    const { client, adapter } = createAdapterWithClient();
    const messages: AITextGenerationRequest["messages"] = [
      { role: "system", content: "System" },
      { role: "user", content: "User" },
      { role: "assistant", content: "Assistant" },
    ];

    await adapter.generateText(buildRequest({ messages }));

    expect(client.calls[0]?.input).toEqual(messages);
  });

  it("preserves system, user and assistant roles", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        messages: [
          { role: "system", content: "System" },
          { role: "user", content: "User" },
          { role: "assistant", content: "Assistant" },
        ],
      }),
    );

    expect(client.calls[0]?.input.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
    ]);
  });

  it("maps temperature", async () => {
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

  it("maps maxOutputTokens to max_output_tokens", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest({ maxOutputTokens: 200 }));

    expect(client.calls[0]?.max_output_tokens).toBe(200);
  });

  it("omits max_output_tokens when undefined", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect("max_output_tokens" in (client.calls[0] ?? {})).toBe(false);
  });

  it("maps primitive metadata values to strings deterministically", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(
      buildRequest({
        metadata: {
          text: "value",
          number: 1000.5,
          trueValue: true,
          falseValue: false,
          nullValue: null,
        },
      }),
    );

    expect(client.calls[0]?.metadata).toEqual({
      text: "value",
      number: "1000.5",
      trueValue: "true",
      falseValue: "false",
      nullValue: "",
    });
  });

  it("omits metadata when undefined", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect("metadata" in (client.calls[0] ?? {})).toBe(false);
  });

  it("sets store false", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect(client.calls[0]?.store).toBe(false);
  });

  it("does not mutate the input request", async () => {
    const { adapter } = createAdapterWithClient();
    const request = buildRequest({ metadata: { purpose: "test" } });
    const before = JSON.stringify(request);

    await adapter.generateText(request);

    expect(JSON.stringify(request)).toBe(before);
  });

  it("does not mutate the source message array", async () => {
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

  it("normalizes provider ID", async () => {
    const response = await createAdapter().generateText(buildRequest());

    expect(response.providerId).toBe("openai");
  });

  it("normalizes provider-reported model", async () => {
    const response = await createAdapterWithResponse(buildResponse({ model: "reported-model" })).generateText(
      buildRequest({ model: "requested-model" }),
    );

    expect(response.model).toBe("reported-model");
  });

  it("normalizes output text", async () => {
    const response = await createAdapterWithResponse(buildResponse({ output_text: "Hello world" })).generateText(
      buildRequest(),
    );

    expect(response.content).toBe("Hello world");
  });

  it("extracts output message text when aggregate output text is unavailable", async () => {
    const response = await createAdapterWithResponse(
      buildResponseWithoutAggregateText({
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "Hello " },
              { type: "output_text", text: "world" },
            ],
          },
        ],
      }),
    ).generateText(buildRequest());

    expect(response.content).toBe("Hello world");
  });

  it("maps response ID to request ID", async () => {
    const response = await createAdapterWithResponse(buildResponse({ id: "resp_custom" })).generateText(
      buildRequest(),
    );

    expect(response.requestId).toBe("resp_custom");
  });

  it("maps input tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.inputTokens).toBe(11);
  });

  it("maps output tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.outputTokens).toBe(7);
  });

  it("maps total tokens", async () => {
    expect((await createAdapter().generateText(buildRequest())).usage.totalTokens).toBe(18);
  });

  it("uses deterministic zero usage when usage is absent", async () => {
    const response = await createAdapterWithResponse(buildResponseWithoutUsage()).generateText(buildRequest());

    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("maps completed status", async () => {
    expect((await createAdapterWithStatus("completed").generateText(buildRequest())).finishReason).toBe(
      "completed",
    );
  });

  it("maps max-token incomplete status", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
    ).generateText(buildRequest());

    expect(response.finishReason).toBe("max_tokens");
  });

  it("maps content-filter incomplete status", async () => {
    const response = await createAdapterWithResponse(
      buildResponse({ status: "incomplete", incomplete_details: { reason: "content_filter" } }),
    ).generateText(buildRequest());

    expect(response.finishReason).toBe("content_filtered");
  });

  it("maps cancelled status", async () => {
    expect((await createAdapterWithStatus("cancelled").generateText(buildRequest())).finishReason).toBe(
      "cancelled",
    );
  });

  it("maps failed status", async () => {
    expect((await createAdapterWithStatus("failed").generateText(buildRequest())).finishReason).toBe("error");
  });

  it("maps unknown status", async () => {
    expect((await createAdapterWithStatus("queued").generateText(buildRequest())).finishReason).toBe("unknown");
  });

  it("does not expose raw provider response data", async () => {
    const response = await createAdapter().generateText(buildRequest());

    expect("output" in response).toBe(false);
    expect("output_text" in response).toBe(false);
    expect("raw" in response).toBe(false);
  });

  it("rejects an empty model", async () => {
    await expect(createAdapter().generateText(buildRequest({ model: "" }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects whitespace-only model", async () => {
    await expect(createAdapter().generateText(buildRequest({ model: " " }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects empty messages", async () => {
    await expect(createAdapter().generateText(buildRequest({ messages: [] }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects invalid temperature below 0", async () => {
    await expect(createAdapter().generateText(buildRequest({ temperature: -0.1 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects invalid temperature above 2", async () => {
    await expect(createAdapter().generateText(buildRequest({ temperature: 2.1 }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects non-finite temperature", async () => {
    await expect(
      createAdapter().generateText(buildRequest({ temperature: Number.POSITIVE_INFINITY })),
    ).rejects.toBeInstanceOf(InvalidAIProviderRequestError);
  });

  it("rejects zero max output tokens", async () => {
    await expect(createAdapter().generateText(buildRequest({ maxOutputTokens: 0 }))).rejects.toBeInstanceOf(
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

  it("rejects invalid metadata constraints where applicable", async () => {
    await expect(createAdapter().generateText(buildRequest({ metadata: { "": "value" } }))).rejects.toBeInstanceOf(
      InvalidAIProviderRequestError,
    );
  });

  it("rejects negative token usage", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usage: usage({ input_tokens: -1 }) })).generateText(buildRequest()),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects fractional token usage", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usage: usage({ output_tokens: 1.5 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects unsafe token usage", async () => {
    await expect(
      createAdapterWithResponse(buildResponse({ usage: usage({ total_tokens: Number.MAX_SAFE_INTEGER + 1 }) })).generateText(
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(InvalidAIProviderResponseError);
  });

  it("rejects an unusable provider response", async () => {
    await expect(createAdapterWithResponse(buildResponse({ id: "" })).generateText(buildRequest())).rejects.toBeInstanceOf(
      InvalidAIProviderResponseError,
    );
  });

  it("handles successful empty text according to the documented policy", async () => {
    const response = await createAdapterWithResponse(buildResponse({ output_text: "" })).generateText(
      buildRequest(),
    );

    expect(response.content).toBe("");
  });

  it("translates authentication errors", async () => {
    await expectFailureCategory(openAIError(new AuthenticationError(401, {}, "secret sk-test", headers())), "authentication");
  });

  it("translates permission errors", async () => {
    await expectFailureCategory(openAIError(new PermissionDeniedError(403, {}, "denied", headers())), "permission_denied");
  });

  it("translates invalid-request errors", async () => {
    await expectFailureCategory(openAIError(new BadRequestError(400, {}, "bad request", headers())), "invalid_request");
  });

  it("translates rate-limit errors", async () => {
    await expectFailureCategory(openAIError(new RateLimitError(429, {}, "rate limited", headers())), "rate_limit");
  });

  it("translates timeout errors", async () => {
    await expectFailureCategory(openAIError(new APIConnectionTimeoutError()), "timeout");
  });

  it("translates provider-unavailable errors", async () => {
    await expectFailureCategory(
      openAIError(new InternalServerError(503, {}, "unavailable", headers())),
      "provider_unavailable",
    );
  });

  it("translates temporary provider errors", async () => {
    await expectFailureCategory(
      openAIError(new APIConnectionError({ message: "connection failed" })),
      "temporary_failure",
    );
  });

  it("translates unknown Error instances", async () => {
    await expectFailureCategory(openAIError(new Error("unknown failure")), "unknown");
  });

  it("translates non-Error thrown values", async () => {
    await expectFailureCategory(openAIError("boom"), "unknown");
  });

  it("does not expose secrets in normalized error messages", async () => {
    try {
      await openAIError(new AuthenticationError(401, {}, "secret sk-test", headers())).generateText(buildRequest());
      throw new Error("Expected adapter to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderExecutionError);
      expect((error as AIProviderExecutionError).message).not.toContain("sk-test");
    }
  });

  it("preserves safe provider status code when available", async () => {
    try {
      await openAIError(new RateLimitError(429, {}, "rate limited", headers())).generateText(buildRequest());
      throw new Error("Expected adapter to throw.");
    } catch (error) {
      expect((error as AIProviderExecutionError).providerStatusCode).toBe(429);
    }
  });

  it("preserves safe provider request ID when available", async () => {
    try {
      await openAIError(new RateLimitError(429, {}, "rate limited", headers("req_custom"))).generateText(
        buildRequest(),
      );
      throw new Error("Expected adapter to throw.");
    } catch (error) {
      expect((error as AIProviderExecutionError).providerRequestId).toBe("req_custom");
    }
  });

  it("performs exactly one provider call per generateText invocation", async () => {
    const { client, adapter } = createAdapterWithClient();

    await adapter.generateText(buildRequest());

    expect(client.calls).toHaveLength(1);
  });

  it("contains no retry loop", async () => {
    const client = new FakeOpenAIClient(() => Promise.reject(new Error("fail")));

    await expect(new OpenAIProviderAdapter(client).generateText(buildRequest())).rejects.toBeInstanceOf(
      AIProviderExecutionError,
    );
    expect(client.calls).toHaveLength(1);
  });

  it("does not require AIProviderRegistryService", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({ providerId: "openai" });
  });

  it("does not require AIExecutionPolicyService", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({ model: "test-model" });
  });

  it("does not read environment variables", async () => {
    await expect(createAdapter().generateText(buildRequest())).resolves.toMatchObject({ providerId: "openai" });
  });

  it("performs no Shopify operation", async () => {
    const shopifyOperation = vi.fn();

    await createAdapter().generateText(buildRequest());

    expect(shopifyOperation).not.toHaveBeenCalled();
  });

  it("works with a fake injected client", async () => {
    const { adapter } = createAdapterWithClient();

    await expect(adapter.generateText(buildRequest())).resolves.toMatchObject({
      providerId: "openai",
      content: "Adapter response",
    });
  });
});

function createAdapter(): OpenAIProviderAdapter {
  return createAdapterWithResponse(buildResponse());
}

function createAdapterWithResponse(response: OpenAIResponse): OpenAIProviderAdapter {
  return createAdapterWithClient(() => Promise.resolve(response)).adapter;
}

function createAdapterWithStatus(status: NonNullable<OpenAIResponse["status"]>): OpenAIProviderAdapter {
  return createAdapterWithResponse(buildResponse({ status }));
}

function createAdapterWithClient(
  handler: (request: OpenAIRequest) => Promise<OpenAIResponse> = () => Promise.resolve(buildResponse()),
): { readonly client: FakeOpenAIClient; readonly adapter: OpenAIProviderAdapter } {
  const client = new FakeOpenAIClient(handler);
  return {
    client,
    adapter: new OpenAIProviderAdapter(client),
  };
}

function openAIError(error: unknown): OpenAIProviderAdapter {
  return createAdapterWithClient(() => {
    throw error;
  }).adapter;
}

async function expectFailureCategory(
  adapter: OpenAIProviderAdapter,
  failureCategory: AIProviderExecutionError["failureCategory"],
): Promise<void> {
  try {
    await adapter.generateText(buildRequest());
    throw new Error("Expected adapter to throw.");
  } catch (error) {
    expect(error).toBeInstanceOf(AIProviderExecutionError);
    expect((error as AIProviderExecutionError).failureCategory).toBe(failureCategory);
  }
}

function buildRequest(overrides: Partial<AITextGenerationRequest> = {}): AITextGenerationRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "Hello" }],
    ...overrides,
  };
}

function buildResponse(overrides: Partial<OpenAIResponse> = {}): OpenAIResponse {
  return {
    id: "resp_test",
    model: "test-model",
    output_text: "Adapter response",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "Adapter response" }],
      },
    ],
    status: "completed",
    incomplete_details: null,
    usage: usage(),
    ...overrides,
  };
}

function buildResponseWithoutAggregateText(overrides: Partial<OpenAIResponse> = {}): OpenAIResponse {
  return {
    id: "resp_test",
    model: "test-model",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "Adapter response" }],
      },
    ],
    status: "completed",
    incomplete_details: null,
    usage: usage(),
    ...overrides,
  };
}

function buildResponseWithoutUsage(overrides: Partial<OpenAIResponse> = {}): OpenAIResponse {
  return {
    id: "resp_test",
    model: "test-model",
    output_text: "Adapter response",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "Adapter response" }],
      },
    ],
    status: "completed",
    incomplete_details: null,
    ...overrides,
  };
}

type OpenAIUsage = NonNullable<OpenAIResponse["usage"]>;

function usage(overrides: Partial<OpenAIUsage> = {}): OpenAIUsage {
  return {
    input_tokens: 11,
    output_tokens: 7,
    total_tokens: 18,
    ...overrides,
  };
}

function headers(requestId = "req_test"): Headers {
  return new Headers({ "x-request-id": requestId });
}
