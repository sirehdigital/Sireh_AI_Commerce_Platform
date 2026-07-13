import { describe, expect, it } from "vitest";
import {
  DuplicateAIProviderError,
  UnknownAIProviderError,
} from "../providers/ai-provider.errors.js";
import type { AIProviderPort } from "../providers/ai-provider.port.js";
import type {
  AIProviderCapabilities,
  AIProviderId,
  AITextGenerationRequest,
  AITextGenerationResponse,
} from "../types/ai-provider.types.js";
import { AIProviderRegistryService } from "./ai-provider-registry.service.js";

const DEFAULT_CAPABILITIES: AIProviderCapabilities = {
  textGeneration: true,
  systemMessages: true,
  temperatureControl: true,
  maxOutputTokensControl: true,
};

class FakeAIProvider implements AIProviderPort {
  public readonly capabilities = DEFAULT_CAPABILITIES;

  public constructor(public readonly providerId: AIProviderId) {}

  public generateText(request: AITextGenerationRequest): Promise<AITextGenerationResponse> {
    return Promise.resolve({
      providerId: this.providerId,
      model: request.model,
      content: `fake response for ${request.messages.at(-1)?.content ?? ""}`,
      finishReason: "completed",
      usage: {
        inputTokens: 5,
        outputTokens: 7,
        totalTokens: 12,
      },
      requestId: `fake-${this.providerId}`,
    });
  }
}

describe("AIProviderRegistryService", () => {
  it("registers and resolves a provider", () => {
    const provider = new FakeAIProvider("mock");
    const registry = new AIProviderRegistryService([provider]);

    expect(registry.resolve("mock")).toBe(provider);
  });

  it("resolves the correct provider when multiple providers are registered", () => {
    const localProvider = new FakeAIProvider("local");
    const mockProvider = new FakeAIProvider("mock");
    const registry = new AIProviderRegistryService([localProvider, mockProvider]);

    expect(registry.resolve("mock")).toBe(mockProvider);
    expect(registry.resolve("local")).toBe(localProvider);
  });

  it("reports whether a provider exists", () => {
    const registry = new AIProviderRegistryService([new FakeAIProvider("mock")]);

    expect(registry.has("mock")).toBe(true);
    expect(registry.has("missing")).toBe(false);
  });

  it("lists registered provider IDs safely", () => {
    const registry = new AIProviderRegistryService([
      new FakeAIProvider("local"),
      new FakeAIProvider("mock"),
    ]);

    expect(registry.listProviderIds()).toEqual(["local", "mock"]);
  });

  it("throws a typed unknown-provider error", () => {
    const registry = new AIProviderRegistryService([]);

    expect(() => registry.resolve("missing")).toThrow(UnknownAIProviderError);
  });

  it("throws a typed duplicate-provider error", () => {
    expect(() => {
      return new AIProviderRegistryService([
        new FakeAIProvider("mock"),
        new FakeAIProvider("MOCK"),
      ]);
    }).toThrow(DuplicateAIProviderError);
  });

  it("does not allow caller mutation of the original providers array to alter registry behaviour", () => {
    const providers: AIProviderPort[] = [new FakeAIProvider("mock")];
    const registry = new AIProviderRegistryService(providers);

    providers.push(new FakeAIProvider("local"));

    expect(registry.has("mock")).toBe(true);
    expect(registry.has("local")).toBe(false);
  });

  it("does not expose an internally mutable provider ID collection", () => {
    const registry = new AIProviderRegistryService([new FakeAIProvider("mock")]);
    const listedIds = registry.listProviderIds();

    (listedIds as AIProviderId[]).push("local");

    expect(registry.listProviderIds()).toEqual(["mock"]);
  });

  it("accepts an empty provider collection", () => {
    const registry = new AIProviderRegistryService([]);

    expect(registry.listProviderIds()).toEqual([]);
    expect(registry.has("mock")).toBe(false);
  });

  it("allows a provider port to return a normalized text-generation response", async () => {
    const registry = new AIProviderRegistryService([new FakeAIProvider("mock")]);
    const provider = registry.resolve("mock");

    const response = await provider.generateText({
      model: "test-model",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.2,
      maxOutputTokens: 64,
      metadata: { purpose: "unit-test", deterministic: true, batch: 1, nullable: null },
    });

    expect(response).toEqual({
      providerId: "mock",
      model: "test-model",
      content: "fake response for hello",
      finishReason: "completed",
      usage: {
        inputTokens: 5,
        outputTokens: 7,
        totalTokens: 12,
      },
      requestId: "fake-mock",
    });
  });
});
