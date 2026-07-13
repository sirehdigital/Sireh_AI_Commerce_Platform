export type AIProviderId = string;

export type AIModelId = string;

export type AIMessageRole = "system" | "user" | "assistant";

export type AIMetadataValue = string | number | boolean | null;

export type AIMetadata = Readonly<Record<string, AIMetadataValue>>;

export type AIFinishReason =
  | "completed"
  | "max_tokens"
  | "content_filtered"
  | "cancelled"
  | "error"
  | "unknown";

export interface AIMessage {
  readonly role: AIMessageRole;
  readonly content: string;
}

export interface AITextGenerationRequest {
  readonly model: AIModelId;
  readonly messages: readonly AIMessage[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly metadata?: AIMetadata;
}

export interface AIUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface AITextGenerationResponse {
  readonly providerId: AIProviderId;
  readonly model: AIModelId;
  readonly content: string;
  readonly finishReason: AIFinishReason;
  readonly usage: AIUsage;
  readonly requestId?: string;
}

export interface AIProviderCapabilities {
  readonly textGeneration: boolean;
  readonly systemMessages: boolean;
  readonly temperatureControl: boolean;
  readonly maxOutputTokensControl: boolean;
}
