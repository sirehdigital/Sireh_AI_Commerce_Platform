import { AppError } from "../../shared/errors/app-error.js";
import type { AIProviderId } from "../types/ai-provider.types.js";

export type AIProviderFailureCategory =
  | "authentication"
  | "permission_denied"
  | "invalid_request"
  | "rate_limit"
  | "timeout"
  | "provider_unavailable"
  | "temporary_failure"
  | "content_filtered"
  | "cancelled"
  | "unknown";

export class UnknownAIProviderError extends AppError {
  public readonly providerId: AIProviderId;

  public constructor(providerId: AIProviderId) {
    super({
      message: `AI provider "${providerId}" is not registered.`,
      statusCode: 400,
      code: "AI_PROVIDER_UNKNOWN",
      details: { providerId },
    });

    this.name = "UnknownAIProviderError";
    this.providerId = providerId;
  }
}

export class DuplicateAIProviderError extends AppError {
  public readonly providerId: AIProviderId;

  public constructor(providerId: AIProviderId) {
    super({
      message: `AI provider "${providerId}" is already registered.`,
      statusCode: 409,
      code: "AI_PROVIDER_DUPLICATE",
      details: { providerId },
    });

    this.name = "DuplicateAIProviderError";
    this.providerId = providerId;
  }
}

export class InvalidAIProviderRegistrationError extends AppError {
  public constructor(message: string) {
    super({
      message,
      statusCode: 400,
      code: "AI_PROVIDER_INVALID_REGISTRATION",
    });

    this.name = "InvalidAIProviderRegistrationError";
  }
}

interface AIProviderExecutionErrorOptions {
  readonly providerId: AIProviderId;
  readonly failureCategory: AIProviderFailureCategory;
  readonly message: string;
  readonly providerStatusCode?: number;
  readonly providerRequestId?: string;
  readonly cause?: unknown;
}

export class AIProviderExecutionError extends AppError {
  public readonly providerId: AIProviderId;
  public readonly failureCategory: AIProviderFailureCategory;
  public readonly providerStatusCode?: number;
  public readonly providerRequestId?: string;
  public override readonly cause?: unknown;

  public constructor(options: AIProviderExecutionErrorOptions) {
    super({
      message: options.message,
      statusCode: 502,
      code: "AI_PROVIDER_EXECUTION_FAILED",
      details: {
        providerId: options.providerId,
        failureCategory: options.failureCategory,
        ...(options.providerStatusCode === undefined
          ? {}
          : { providerStatusCode: options.providerStatusCode }),
        ...(options.providerRequestId === undefined
          ? {}
          : { providerRequestId: options.providerRequestId }),
      },
    });

    this.name = "AIProviderExecutionError";
    this.providerId = options.providerId;
    this.failureCategory = options.failureCategory;

    if (options.providerStatusCode !== undefined) {
      this.providerStatusCode = options.providerStatusCode;
    }

    if (options.providerRequestId !== undefined) {
      this.providerRequestId = options.providerRequestId;
    }

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class InvalidAIProviderRequestError extends AIProviderExecutionError {
  public constructor(providerId: AIProviderId, message: string) {
    super({
      providerId,
      failureCategory: "invalid_request",
      message,
    });

    this.name = "InvalidAIProviderRequestError";
  }
}

export class InvalidAIProviderResponseError extends AIProviderExecutionError {
  public constructor(providerId: AIProviderId, message: string, cause?: unknown) {
    super({
      providerId,
      failureCategory: "unknown",
      message,
      ...(cause === undefined ? {} : { cause }),
    });

    this.name = "InvalidAIProviderResponseError";
  }
}
