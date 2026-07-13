import { AppError } from "../../../../shared/errors/app-error.js";

export class InvalidContentValueError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_INVALID_VALUE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidContentValueError";
  }
}

export class InvalidContentStateTransitionError extends AppError {
  public constructor(from: string, to: string) {
    super({
      message: `Invalid content state transition from "${from}" to "${to}".`,
      statusCode: 400,
      code: "CONTENT_INVALID_STATE_TRANSITION",
      details: { from, to },
    });

    this.name = "InvalidContentStateTransitionError";
  }
}

export class IncompatibleContentChannelError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_INCOMPATIBLE_CHANNEL",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "IncompatibleContentChannelError";
  }
}

export class InvalidContentTemplateError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_INVALID_TEMPLATE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidContentTemplateError";
  }
}

export class InvalidContentSEOConfigurationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_INVALID_SEO_CONFIGURATION",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidContentSEOConfigurationError";
  }
}

export class InvalidQualityScoreError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_INVALID_QUALITY_SCORE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidQualityScoreError";
  }
}
