import {
  DuplicateAIProviderError,
  InvalidAIProviderRegistrationError,
  UnknownAIProviderError,
} from "../providers/ai-provider.errors.js";
import type { AIProviderPort } from "../providers/ai-provider.port.js";
import type { AIProviderId } from "../types/ai-provider.types.js";

export class AIProviderRegistryService {
  private readonly providersById: ReadonlyMap<string, AIProviderPort>;
  private readonly providerIds: readonly AIProviderId[];

  public constructor(providers: readonly AIProviderPort[]) {
    const registrations = new Map<string, AIProviderPort>();
    const providerIds: AIProviderId[] = [];

    for (const provider of providers) {
      this.assertValidProvider(provider);

      const providerId = provider.providerId.trim();
      const providerKey = this.normalizeProviderId(providerId);

      if (registrations.has(providerKey)) {
        throw new DuplicateAIProviderError(providerId);
      }

      registrations.set(providerKey, provider);
      providerIds.push(providerId);
    }

    this.providersById = registrations;
    this.providerIds = Object.freeze([...providerIds]);
  }

  public resolve(providerId: AIProviderId): AIProviderPort {
    const provider = this.providersById.get(this.normalizeProviderId(providerId));

    if (provider === undefined) {
      throw new UnknownAIProviderError(providerId);
    }

    return provider;
  }

  public has(providerId: AIProviderId): boolean {
    return this.providersById.has(this.normalizeProviderId(providerId));
  }

  public listProviderIds(): readonly AIProviderId[] {
    return [...this.providerIds];
  }

  private assertValidProvider(provider: AIProviderPort): void {
    if (provider.providerId.trim().length === 0) {
      throw new InvalidAIProviderRegistrationError("AI provider ID must be a non-empty string.");
    }

    if (!provider.capabilities.textGeneration) {
      throw new InvalidAIProviderRegistrationError(
        `AI provider "${provider.providerId}" must support text generation.`,
      );
    }
  }

  private normalizeProviderId(providerId: AIProviderId): string {
    return providerId.trim().toLowerCase();
  }
}
