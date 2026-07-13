import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "@anthropic-ai/sdk";
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

const ANTHROPIC_PROVIDER_ID: AIProviderId = "anthropic";

type ClaudeInputRole = "user" | "assistant";

interface ClaudeMessageCreateParams {
  readonly model: string;
  readonly max_tokens: number;
  readonly messages: readonly ClaudeMessageParam[];
  readonly system?: string;
  readonly temperature?: number;
}

interface ClaudeMessageParam {
  readonly role: ClaudeInputRole;
  readonly content: string;
}

interface ClaudeTextBlock {
  readonly type: "text";
  readonly text: string;
}

interface ClaudeUnsupportedContentBlock {
  readonly type: string;
}

type ClaudeContentBlock = ClaudeTextBlock | ClaudeUnsupportedContentBlock;

interface ClaudeUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
}

interface ClaudeMessageResult {
  readonly id: string;
  readonly model?: string;
  readonly content: readonly ClaudeContentBlock[];
  readonly stop_reason: string | null;
  readonly usage?: ClaudeUsage | null;
  readonly _request_id?: string | null;
}

export interface AnthropicMessagesClientDependency {
  readonly messages: {
    create(request: ClaudeMessageCreateParams): Promise<ClaudeMessageResult>;
  };
}

interface MappedMessages {
  readonly system?: string;
  readonly messages: readonly ClaudeMessageParam[];
}

export class ClaudeProviderAdapter implements AIProviderPort {
  public readonly providerId = ANTHROPIC_PROVIDER_ID;

  public readonly capabilities: AIProviderCapabilities = {
    textGeneration: true,
    systemMessages: true,
    temperatureControl: true,
    maxOutputTokensControl: true,
  };

  public constructor(private readonly client: AnthropicMessagesClientDependency) {}

  public async generateText(
    request: AITextGenerationRequest,
  ): Promise<AITextGenerationResponse> {
    this.validateRequest(request);

    try {
      const claudeResponse = await this.client.messages.create(this.mapRequest(request));
      return this.mapResponse(request, claudeResponse);
    } catch (error) {
      throw this.toProviderError(error);
    }
  }

  private mapRequest(request: AITextGenerationRequest): ClaudeMessageCreateParams {
    const mappedMessages = this.mapMessages(request.messages);

    return {
      model: request.model,
      max_tokens: this.resolveMaxOutputTokens(request),
      messages: mappedMessages.messages,
      ...(mappedMessages.system === undefined ? {} : { system: mappedMessages.system }),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    };
  }

  private mapMessages(messages: readonly AIMessage[]): MappedMessages {
    const systemMessages: string[] = [];
    const conversationMessages: ClaudeMessageParam[] = [];
    let hasSeenConversation = false;

    for (const message of messages) {
      if (message.role === "system") {
        if (hasSeenConversation) {
          throw new InvalidAIProviderRequestError(
            this.providerId,
            "Claude system messages must appear before user or assistant messages.",
          );
        }

        systemMessages.push(message.content);
        continue;
      }

      hasSeenConversation = true;
      conversationMessages.push({
        role: message.role,
        content: message.content,
      });
    }

    if (conversationMessages.length === 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Claude text generation requires at least one user or assistant message.",
      );
    }

    return {
      messages: conversationMessages,
      ...(systemMessages.length === 0 ? {} : { system: systemMessages.join("\n\n") }),
    };
  }

  private mapResponse(
    request: AITextGenerationRequest,
    response: ClaudeMessageResult,
  ): AITextGenerationResponse {
    this.validateResponseIdentity(response);
    const model = this.resolveModel(request, response);

    return {
      providerId: this.providerId,
      model,
      content: this.extractContent(response),
      finishReason: this.mapFinishReason(response.stop_reason),
      usage: this.mapUsage(response.usage),
      ...(response._request_id === undefined || response._request_id === null
        ? {}
        : { requestId: response._request_id }),
    };
  }

  private validateRequest(request: AITextGenerationRequest): void {
    if (request.model.trim().length === 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Claude model ID must not be empty.",
      );
    }

    if (request.messages.length === 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Claude text generation requires at least one message.",
      );
    }

    for (const message of request.messages) {
      if (message.content.trim().length === 0) {
        throw new InvalidAIProviderRequestError(
          this.providerId,
          "Claude message content must not be empty.",
        );
      }
    }

    this.resolveMaxOutputTokens(request);
    this.validateTemperature(request.temperature);
    this.mapMessages(request.messages);
  }

  private resolveMaxOutputTokens(request: AITextGenerationRequest): number {
    if (request.maxOutputTokens === undefined) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Claude max output tokens are required.",
      );
    }

    if (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Claude max output tokens must be a positive safe integer.",
      );
    }

    return request.maxOutputTokens;
  }

  private validateTemperature(temperature: number | undefined): void {
    if (
      temperature !== undefined &&
      (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
    ) {
      throw new InvalidAIProviderRequestError(
        this.providerId,
        "Claude temperature must be a finite number between 0 and 2.",
      );
    }
  }

  private validateResponseIdentity(response: ClaudeMessageResult): void {
    if (response.id.trim().length === 0) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        "Claude response ID is structurally unusable.",
      );
    }

    if (!Array.isArray(response.content)) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        "Claude response content is structurally unusable.",
      );
    }
  }

  private resolveModel(request: AITextGenerationRequest, response: ClaudeMessageResult): string {
    const responseModel = response.model?.trim();

    if (responseModel !== undefined && responseModel.length > 0) {
      return responseModel;
    }

    if (request.model.trim().length > 0) {
      return request.model;
    }

    throw new InvalidAIProviderResponseError(
      this.providerId,
      "Claude response model cannot be determined.",
    );
  }

  private extractContent(response: ClaudeMessageResult): string {
    return response.content
      .filter((block): block is ClaudeTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  private mapFinishReason(stopReason: ClaudeMessageResult["stop_reason"]): AIFinishReason {
    if (stopReason === "end_turn" || stopReason === "stop_sequence") {
      return "completed";
    }

    if (stopReason === "max_tokens") {
      return "max_tokens";
    }

    if (stopReason === "refusal") {
      return "content_filtered";
    }

    return "unknown";
  }

  private mapUsage(usage: ClaudeUsage | null | undefined): AIUsage {
    if (usage === undefined || usage === null) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
    }

    this.validateUsageValue(usage.input_tokens, "input");
    this.validateUsageValue(usage.output_tokens, "output");

    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    };
  }

  private validateUsageValue(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidAIProviderResponseError(
        this.providerId,
        `Claude ${label} token usage must be a non-negative safe integer.`,
      );
    }
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
      message: "Claude provider request failed.",
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

    if (
      error instanceof BadRequestError ||
      error instanceof NotFoundError ||
      error instanceof UnprocessableEntityError
    ) {
      return "invalid_request";
    }

    if (error instanceof ConflictError) {
      return "temporary_failure";
    }

    if (error instanceof RateLimitError) {
      return "rate_limit";
    }

    if (error instanceof APIConnectionTimeoutError) {
      return "timeout";
    }

    if (error instanceof InternalServerError) {
      const status = this.providerStatusCode(error);
      return status === undefined ? "temporary_failure" : this.classifyServerStatus(status);
    }

    if (error instanceof APIConnectionError) {
      return "temporary_failure";
    }

    const status = this.providerStatusCode(error);

    if (status !== undefined) {
      return this.classifyStatus(status);
    }

    return "unknown";
  }

  private classifyServerStatus(status: number): AIProviderFailureCategory {
    if (status === 502 || status === 503 || status === 529) {
      return "provider_unavailable";
    }

    if (status === 504) {
      return "timeout";
    }

    return "temporary_failure";
  }

  private classifyStatus(status: number): AIProviderFailureCategory {
    if (status === 400 || status === 404 || status === 413 || status === 422) {
      return "invalid_request";
    }

    if (status === 401) {
      return "authentication";
    }

    if (status === 402 || status === 403) {
      return "permission_denied";
    }

    if (status === 409 || status === 500) {
      return "temporary_failure";
    }

    if (status === 429) {
      return "rate_limit";
    }

    if (status === 502 || status === 503 || status === 529) {
      return "provider_unavailable";
    }

    if (status === 504) {
      return "timeout";
    }

    return "unknown";
  }

  private providerStatusCode(error: unknown): number | undefined {
    if (error instanceof APIError && typeof error.status === "number") {
      return error.status;
    }

    return undefined;
  }

  private providerRequestId(error: unknown): string | undefined {
    if (error instanceof APIError) {
      return error.requestID ?? undefined;
    }

    return undefined;
  }
}
