import type {
  AIProviderCapabilities,
  AIProviderId,
  AITextGenerationRequest,
  AITextGenerationResponse,
} from "../types/ai-provider.types.js";

export interface AIProviderPort {
  readonly providerId: AIProviderId;
  readonly capabilities: AIProviderCapabilities;

  generateText(request: AITextGenerationRequest): Promise<AITextGenerationResponse>;
}
