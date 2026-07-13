import { AppError } from "../../../../shared/errors/app-error.js";

class AIContentOrchestrationError extends AppError {
  public constructor(
    name: string,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super({ message, statusCode: 422, code, ...(details === undefined ? {} : { details }) });
    this.name = name;
  }
}

export class InvalidAIContentOrchestrationInputError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super(
      "InvalidAIContentOrchestrationInputError",
      "AI_CONTENT_ORCHESTRATION_INVALID_INPUT",
      message,
      details,
    );
  }
}

export class InvalidAIContentOrchestrationOptionsError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super(
      "InvalidAIContentOrchestrationOptionsError",
      "AI_CONTENT_ORCHESTRATION_INVALID_OPTIONS",
      message,
      details,
    );
  }
}

export class InvalidAIContentExecutionPlanError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super(
      "InvalidAIContentExecutionPlanError",
      "AI_CONTENT_ORCHESTRATION_INVALID_PLAN",
      message,
      details,
    );
  }
}

export class MissingAIContentDependencyError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super(
      "MissingAIContentDependencyError",
      "AI_CONTENT_ORCHESTRATION_MISSING_DEPENDENCY",
      message,
      details,
    );
  }
}

export class AIContentStageExecutionError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super(
      "AIContentStageExecutionError",
      "AI_CONTENT_ORCHESTRATION_STAGE_FAILED",
      message,
      details,
    );
  }
}

export class AIContentStageBlockedError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super("AIContentStageBlockedError", "AI_CONTENT_ORCHESTRATION_STAGE_BLOCKED", message, details);
  }
}

export class AIContentQualityGateError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super("AIContentQualityGateError", "AI_CONTENT_ORCHESTRATION_QUALITY_GATE", message, details);
  }
}

export class AIContentLocalizationStageError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super(
      "AIContentLocalizationStageError",
      "AI_CONTENT_ORCHESTRATION_LOCALIZATION",
      message,
      details,
    );
  }
}

export class AIContentPortfolioAssemblyError extends AIContentOrchestrationError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super(
      "AIContentPortfolioAssemblyError",
      "AI_CONTENT_ORCHESTRATION_PORTFOLIO",
      message,
      details,
    );
  }
}

export class UnsupportedAIContentStageError extends AIContentOrchestrationError {
  public constructor(stage: string) {
    super(
      "UnsupportedAIContentStageError",
      "AI_CONTENT_ORCHESTRATION_UNSUPPORTED_STAGE",
      `Unsupported AI Content stage: ${stage}.`,
      { stage },
    );
  }
}
