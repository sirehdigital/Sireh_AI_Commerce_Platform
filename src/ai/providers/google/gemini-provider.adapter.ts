import { ApiError } from "@google/genai";
import {
  AIProviderExecutionError,
  type AIProviderFailureCategory,
  InvalidAIProviderRequestError,
  InvalidAIProviderResponseError,
} from "../ai-provider.errors.js";
import type { AIProviderPort } from "../ai-provider.port.js";
import type {
  AIFinishReason,
  AIMessage,
  AIProviderCapabilities,
  AIProviderId,
  AITextGenerationRequest,
  AITextGenerationResponse,
  AIUsage,
} from "../../types/ai-provider.types.js";

const GOOGLE_PROVIDER_ID: AIProviderId = "google";

type GeminiRole = "user" | "model";

interface GeminiGenerateContentRequest {
  readonly model: string;
  readonly contents: readonly GeminiContent[];
  readonly config?: GeminiGenerationConfig;
}

interface GeminiGenerationConfig {
  readonly systemInstruction?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

interface GeminiContent {
  readonly role: GeminiRole;
  readonly parts: readonly GeminiPart[];
}

interface GeminiPart {
  readonly text?: string;
  readonly [key: string]: unknown;
}

interface GeminiCandidate {
  readonly content?: {
    readonly parts?: readonly GeminiPart[];
  };
  readonly finishReason?: string;
}

interface GeminiPromptFeedback {
  readonly blockReason?: string;
}

interface GeminiUsageMetadata {
  readonly promptTokenCount?: number;
  readonly candidatesTokenCount?: number;
  readonly responseTokenCount?: number;
  readonly totalTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  readonly candidates?: readonly GeminiCandidate[];
  readonly modelVersion?: string;
  readonly promptFeedback?: GeminiPromptFeedback;
  readonly responseId?: string;
  readonly usageMetadata?: GeminiUsageMetadata;
}

export interface GeminiClientDependency {
  readonly models: {
    generateContent(request: GeminiGenerateContentRequest): Promise<GeminiGenerateContentResponse>;
  };
}

interface MappedContents {
  readonly systemInstruction?: string;
  readonly contents: readonly GeminiContent[];
}

export class GeminiProviderAdapter implements AIProviderPort {
  public readonly providerId = GOOGLE_PROVIDER_ID;

  public readonly capabilities: AIProviderCapabilities = {
    textGeneration: true,
    systemMessages: true,
    temperatureControl: true,
    maxOutputTokensControl: true,
  };

  public constructor(private readonly client: GeminiClientDependency) {}

  public async generateText(
    request: AITextGenerationRequest,
  ): Promise<AITextGenerationResponse> {
    this.validateRequest(request);

    try {
      const geminiResponse = await this.client.models.generateContent(this.mapRequest(request));
      return this.mapResponse(request, geminiResponse);
    } catch (error) {
      throw this.toProviderError(error);
    }
  }

  private mapRequest(request: AITextGenerationRequest): GeminiGenerateContentRequest {
    const mappedContents = this.mapMessages(request.messages);
    const config = this.mapConfig(request, mappedContents);

    return {
      model: request.model,
      contents: mappedContents.contents,
      ...(config === undefined ? {} : { config }),
    };
  }

  private mapConfig(
    request: AITextGenerationRequest,
    mappedContents: MappedContents,
  ): GeminiGenerationConfig | undefined {
    const config: GeminiGenerationConfig = {
      ...(mappedContents.systemInstruction === undefined
        ? {}
        : { systemInstruction: mappedContents.systemInstruction }),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: request.maxOutputTokens }),
    };

    return Object.keys(config).length === 0 ? undefined : config;
  }

  private mapMessages(messages: readonly AIMessage[]): MappedContents {
    const systemMessages: string[] = [];
    const contents: GeminiContent[] = [];
    let hasSeenConversation = false;

    for (const message of messages) {
      if (message.role === "system") {
        if (hasSeenConversation) {
          throw new InvalidAIProviderRequestError(
            this.providerId,
            "Gemini system messages must appear before user or assistant messages.",
          );
        }

        systemMessages.push(message.content);
        continue;
      }

      hasSeenConversation = true;
      contents.push({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      });
    }

    if (contents.length === 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Gemini text generation requires at least one user or assistant message.",
      );
    }

    return {
      contents,
      ...(systemMessages.length === 0
        ? {}
        : { systemInstruction: systemMessages.join("\n\n") }),
    };
  }

  private mapResponse(
    request: AITextGenerationRequest,
    response: GeminiGenerateContentResponse,
  ): AITextGenerationResponse {
    const model = this.resolveModel(request, response);

    return {
      providerId: this.providerId,
      model,
      content: this.extractContent(response),
      finishReason: this.mapFinishReason(response),
      usage: this.mapUsage(response.usageMetadata),
      ...(response.responseId === undefined ? {} : { requestId: response.responseId }),
    };
  }

  private validateRequest(request: AITextGenerationRequest): void {
    if (request.model.trim().length === 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Gemini model ID must not be empty.",
      );
    }

    if (request.messages.length === 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Gemini text generation requires at least one message.",
      );
    }

    for (const message of request.messages) {
      if (message.content.trim().length === 0) {
        throw new InvalidAIProviderRequestError(
          this.providerId,
          "Gemini message content must not be empty.",
        );
      }
    }

    this.validateTemperature(request.temperature);
    this.validateMaxOutputTokens(request.maxOutputTokens);
    this.mapMessages(request.messages);
  }

  private validateTemperature(temperature: number | undefined): void {
    if (
      temperature !== undefined &&
      (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
    ) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Gemini temperature must be a finite number between 0 and 2.",
      );
    }
  }

  private validateMaxOutputTokens(maxOutputTokens: number | undefined): void {
    if (
      maxOutputTokens !== undefined &&
      (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens <= 0)
    ) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Gemini max output tokens must be a positive safe integer.",
      );
    }
  }

  private resolveModel(
    request: AITextGenerationRequest,
    response: GeminiGenerateContentResponse,
  ): string {
    const responseModel = response.modelVersion?.trim();

    if (responseModel !== undefined && responseModel.length > 0) {
      return responseModel;
    }

    if (request.model.trim().length > 0) {
      return request.model;
    }

    throw new InvalidAIProviderResponseError(
      this.providerId,
      "Gemini response model cannot be determined.",
    );
  }

  private extractContent(response: GeminiGenerateContentResponse): string {
    const firstCandidate = response.candidates?.[0];

    if (firstCandidate === undefined) {
      return "";
    }

    const candidateParts = firstCandidate.content?.parts;

    if (candidateParts === undefined) {
      return "";
    }

    if (!Array.isArray(candidateParts)) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        "Gemini response parts are structurally unusable.",
      );
    }

    const parts: readonly GeminiPart[] = candidateParts;

    return parts
      .filter((part): part is GeminiPart & { readonly text: string } => typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }

  private mapFinishReason(response: GeminiGenerateContentResponse): AIFinishReason {
    const firstCandidate = response.candidates?.[0];

    if (firstCandidate === undefined) {
      return this.isPromptBlocked(response.promptFeedback) ? "content_filtered" : "unknown";
    }

    switch (firstCandidate.finishReason) {
      case "STOP":
        return "completed";
      case "MAX_TOKENS":
        return "max_tokens";
      case "SAFETY":
      case "RECITATION":
      case "LANGUAGE":
      case "BLOCKLIST":
      case "PROHIBITED_CONTENT":
      case "SPII":
      case "IMAGE_SAFETY":
      case "IMAGE_PROHIBITED_CONTENT":
      case "IMAGE_RECITATION":
        return "content_filtered";
      case "MALFORMED_FUNCTION_CALL":
      case "UNEXPECTED_TOOL_CALL":
      case "NO_IMAGE":
      case "IMAGE_OTHER":
        return "error";
      default:
        return "unknown";
    }
  }

  private isPromptBlocked(promptFeedback: GeminiPromptFeedback | undefined): boolean {
    if (promptFeedback?.blockReason === undefined) {
      return false;
    }

    return promptFeedback.blockReason !== "BLOCKED_REASON_UNSPECIFIED";
  }

  private mapUsage(usage: GeminiUsageMetadata | undefined): AIUsage {
    if (usage === undefined) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
    }

    const inputTokens = usage.promptTokenCount ?? 0;
    const outputTokens = usage.candidatesTokenCount ?? usage.responseTokenCount ?? 0;
    const totalTokens = usage.totalTokenCount ?? inputTokens + outputTokens;

    this.validateUsageValue(inputTokens, "input");
    this.validateUsageValue(outputTokens, "output");
    this.validateUsageValue(totalTokens, "total");

    return {
      inputTokens,
      outputTokens,
      totalTokens,
    };
  }

  private validateUsageValue(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        `Gemini ${label} token usage must be a non-negative safe integer.`,
      );
    }
  }

  private toProviderError(error: unknown): AIProviderExecutionError {
    if (error instanceof AIProviderExecutionError) {
      return error;
    }

    const providerStatusCode = this.providerStatusCode(error);

    return new AIProviderExecutionError({
      providerId: this.providerId,
      failureCategory:
        providerStatusCode === undefined ? this.classifyUnknownError(error) : this.classifyStatus(providerStatusCode),
      message: "Gemini provider request failed.",
      ...(providerStatusCode === undefined ? {} : { providerStatusCode }),
      cause: error,
    });
  }

  private classifyUnknownError(error: unknown): AIProviderFailureCategory {
    if (error instanceof TypeError) {
      return "temporary_failure";
    }

    return "unknown";
  }

  private classifyStatus(status: number): AIProviderFailureCategory {
    if (status === 400 || status === 404 || status === 413) {
      return "invalid_request";
    }

    if (status === 401) {
      return "authentication";
    }

    if (status === 403) {
      return "permission_denied";
    }

    if (status === 408 || status === 504) {
      return "timeout";
    }

    if (status === 409 || status === 500) {
      return "temporary_failure";
    }

    if (status === 429) {
      return "rate_limit";
    }

    if (status === 499) {
      return "cancelled";
    }

    if (status === 502 || status === 503) {
      return "provider_unavailable";
    }

    return "unknown";
  }

  private providerStatusCode(error: unknown): number | undefined {
    if (error instanceof ApiError && Number.isSafeInteger(error.status)) {
      return error.status;
    }

    return undefined;
  }
}
