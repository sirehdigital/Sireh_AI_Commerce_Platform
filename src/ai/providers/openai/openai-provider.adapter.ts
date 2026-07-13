import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import {
  AIProviderExecutionError,
  type AIProviderFailureCategory,
  InvalidAIProviderRequestError,
  InvalidAIProviderResponseError,
} from "../ai-provider.errors.js";
import type { AIProviderPort } from "../ai-provider.port.js";
import type {
  AIFinishReason,
  AIMetadata,
  AIMessage,
  AIProviderCapabilities,
  AIProviderId,
  AITextGenerationRequest,
  AITextGenerationResponse,
  AIUsage,
} from "../../types/ai-provider.types.js";

const OPENAI_PROVIDER_ID: AIProviderId = "openai";
const MAX_OPENAI_METADATA_ENTRIES = 16;
const MAX_OPENAI_METADATA_KEY_LENGTH = 64;
const MAX_OPENAI_METADATA_VALUE_LENGTH = 512;

type OpenAIInputRole = "system" | "user" | "assistant";
type OpenAIResponseStatus = "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete";
type OpenAIIncompleteReason = "max_output_tokens" | "content_filter";

interface OpenAIResponseInputMessage {
  readonly role: OpenAIInputRole;
  readonly content: string;
}

interface OpenAIResponseCreateParams {
  readonly model: string;
  readonly input: readonly OpenAIResponseInputMessage[];
  readonly store: false;
  readonly temperature?: number;
  readonly max_output_tokens?: number;
  readonly metadata?: Record<string, string>;
}

interface OpenAIOutputTextItem {
  readonly type: "output_text";
  readonly text: string;
}

interface OpenAIOutputRefusalItem {
  readonly type: "refusal";
  readonly refusal: string;
}

interface OpenAIOutputMessage {
  readonly type: "message";
  readonly content: readonly (OpenAIOutputTextItem | OpenAIOutputRefusalItem)[];
}

interface OpenAIResponseUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
}

interface OpenAIResponseResult {
  readonly id: string;
  readonly model?: string;
  readonly output_text?: string;
  readonly output?: readonly OpenAIOutputMessage[];
  readonly status?: OpenAIResponseStatus;
  readonly incomplete_details?: {
    readonly reason?: OpenAIIncompleteReason;
  } | null;
  readonly usage?: OpenAIResponseUsage | null;
}

export interface OpenAIResponsesClientDependency {
  readonly responses: {
    create(request: OpenAIResponseCreateParams): Promise<OpenAIResponseResult>;
  };
}

export class OpenAIProviderAdapter implements AIProviderPort {
  public readonly providerId = OPENAI_PROVIDER_ID;

  public readonly capabilities: AIProviderCapabilities = {
    textGeneration: true,
    systemMessages: true,
    temperatureControl: true,
    maxOutputTokensControl: true,
  };

  public constructor(private readonly client: OpenAIResponsesClientDependency) {}

  public async generateText(
    request: AITextGenerationRequest,
  ): Promise<AITextGenerationResponse> {
    this.validateRequest(request);

    try {
      const openAIResponse = await this.client.responses.create(this.mapRequest(request));
      return this.mapResponse(request, openAIResponse);
    } catch (error) {
      throw this.toProviderError(error);
    }
  }

  private mapRequest(request: AITextGenerationRequest): OpenAIResponseCreateParams {
    return {
      model: request.model,
      input: this.mapMessages(request.messages),
      store: false,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxOutputTokens === undefined
        ? {}
        : { max_output_tokens: request.maxOutputTokens }),
      ...(request.metadata === undefined ? {} : { metadata: this.mapMetadata(request.metadata) }),
    };
  }

  private mapMessages(messages: readonly AIMessage[]): readonly OpenAIResponseInputMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  private mapMetadata(metadata: AIMetadata): Record<string, string> {
    const entries = Object.entries(metadata);

    if (entries.length > MAX_OPENAI_METADATA_ENTRIES) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        `OpenAI metadata must contain ${MAX_OPENAI_METADATA_ENTRIES} entries or fewer.`,
      );
    }

    const mappedMetadata: Record<string, string> = {};

    for (const [key, value] of entries) {
      const mappedValue = this.metadataValueToString(value);

      if (key.length === 0 || key.length > MAX_OPENAI_METADATA_KEY_LENGTH) {
        throw new InvalidAIProviderRequestError(
          this.providerId,
          "OpenAI metadata keys must be between 1 and 64 characters.",
        );
      }

      if (mappedValue.length > MAX_OPENAI_METADATA_VALUE_LENGTH) {
        throw new InvalidAIProviderRequestError(
          this.providerId,
          "OpenAI metadata values must be 512 characters or fewer.",
        );
      }

      mappedMetadata[key] = mappedValue;
    }

    return mappedMetadata;
  }

  private mapResponse(
    request: AITextGenerationRequest,
    response: OpenAIResponseResult,
  ): AITextGenerationResponse {
    this.validateResponseIdentity(response);
    const model = this.resolveModel(request, response);

    return {
      providerId: this.providerId,
      model,
      content: this.extractContent(response),
      finishReason: this.mapFinishReason(response),
      usage: this.mapUsage(response.usage),
      requestId: response.id,
    };
  }

  private validateRequest(request: AITextGenerationRequest): void {
    if (request.model.trim().length === 0) {
      throw new InvalidAIProviderRequestError(this.providerId, "OpenAI model ID must not be empty.");
    }

    if (request.messages.length === 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "OpenAI text generation requires at least one message.",
      );
    }

    for (const message of request.messages) {
      if (message.content.trim().length === 0) {
        throw new InvalidAIProviderRequestError(
          this.providerId,
          "OpenAI message content must not be empty.",
        );
      }
    }

    if (
      request.temperature !== undefined &&
      (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2)
    ) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "OpenAI temperature must be a finite number between 0 and 2.",
      );
    }

    if (
      request.maxOutputTokens !== undefined &&
      (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0)
    ) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "OpenAI max output tokens must be a positive safe integer.",
      );
    }

    if (request.metadata !== undefined) {
      this.mapMetadata(request.metadata);
    }
  }

  private validateResponseIdentity(response: OpenAIResponseResult): void {
    if (response.id.trim().length === 0) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        "OpenAI response ID is structurally unusable.",
      );
    }
  }

  private resolveModel(
    request: AITextGenerationRequest,
    response: OpenAIResponseResult,
  ): string {
    const responseModel = response.model?.trim();

    if (responseModel !== undefined && responseModel.length > 0) {
      return responseModel;
    }

    if (request.model.trim().length > 0) {
      return request.model;
    }

    throw new InvalidAIProviderResponseError(
      this.providerId,
      "OpenAI response model cannot be determined.",
    );
  }

  private extractContent(response: OpenAIResponseResult): string {
    if (typeof response.output_text === "string") {
      return response.output_text;
    }

    if (response.output === undefined) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        "OpenAI response output is structurally unusable.",
      );
    }

    return response.output
      .flatMap((item) => item.content)
      .filter((contentItem): contentItem is OpenAIOutputTextItem => {
        return contentItem.type === "output_text";
      })
      .map((contentItem) => contentItem.text)
      .join("");
  }

  private mapFinishReason(response: OpenAIResponseResult): AIFinishReason {
    if (response.status === "completed") {
      return "completed";
    }

    if (response.status === "cancelled") {
      return "cancelled";
    }

    if (response.status === "failed") {
      return "error";
    }

    if (response.status === "incomplete") {
      if (response.incomplete_details?.reason === "max_output_tokens") {
        return "max_tokens";
      }

      if (response.incomplete_details?.reason === "content_filter") {
        return "content_filtered";
      }
    }

    return "unknown";
  }

  private mapUsage(usage: OpenAIResponseUsage | null | undefined): AIUsage {
    if (usage === undefined || usage === null) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
    }

    this.validateUsageValue(usage.input_tokens, "input");
    this.validateUsageValue(usage.output_tokens, "output");
    this.validateUsageValue(usage.total_tokens, "total");

    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.total_tokens,
    };
  }

  private validateUsageValue(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        `OpenAI ${label} token usage must be a non-negative safe integer.`,
      );
    }
  }

  private metadataValueToString(value: AIMetadata[string]): string {
    if (value === null) {
      return "";
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return String(value);
  }

  private toProviderError(error: unknown): AIProviderExecutionError {
    if (error instanceof AIProviderExecutionError) {
      return error;
    }

    const providerStatusCode = this.providerStatusCode(error);
    const providerRequestId = this.providerRequestId(error);

    return new AIProviderExecutionError({
      providerId: this.providerId,
      failureCategory: this.classifyError(error),
      message: "OpenAI provider request failed.",
      ...(providerStatusCode === undefined ? {} : { providerStatusCode }),
      ...(providerRequestId === undefined ? {} : { providerRequestId }),
      cause: error,
    });
  }

  private classifyError(error: unknown): AIProviderFailureCategory {
    if (error instanceof AuthenticationError) {
      return "authentication";
    }

    if (error instanceof PermissionDeniedError) {
      return "permission_denied";
    }

    if (error instanceof BadRequestError || error instanceof UnprocessableEntityError) {
      return "invalid_request";
    }

    if (error instanceof RateLimitError) {
      return "rate_limit";
    }

    if (error instanceof APIConnectionTimeoutError) {
      return "timeout";
    }

    if (error instanceof InternalServerError) {
      return "provider_unavailable";
    }

    if (error instanceof APIConnectionError) {
      return "temporary_failure";
    }

    return "unknown";
  }

  private providerStatusCode(error: unknown): number | undefined {
    if (
      error instanceof AuthenticationError ||
      error instanceof PermissionDeniedError ||
      error instanceof BadRequestError ||
      error instanceof UnprocessableEntityError ||
      error instanceof RateLimitError ||
      error instanceof InternalServerError
    ) {
      return error.status;
    }

    return undefined;
  }

  private providerRequestId(error: unknown): string | undefined {
    if (
      error instanceof AuthenticationError ||
      error instanceof PermissionDeniedError ||
      error instanceof BadRequestError ||
      error instanceof UnprocessableEntityError ||
      error instanceof RateLimitError ||
      error instanceof InternalServerError
    ) {
      return error.requestID ?? undefined;
    }

    return undefined;
  }
}
