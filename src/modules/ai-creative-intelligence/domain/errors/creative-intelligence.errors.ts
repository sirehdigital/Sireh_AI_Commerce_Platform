import { AppError, type ErrorDetails } from "../../../../shared/errors/app-error.js";

export class CreativeIntelligenceInvalidRequestError extends AppError {
  public constructor(message = "Creative intelligence request is invalid.", details?: ErrorDetails) {
    super({
      message,
      statusCode: 400,
      code: "INVALID_CREATIVE_INTELLIGENCE_REQUEST",
      ...(details === undefined ? {} : { details }),
    });
  }
}
export class CreativeIntelligenceInvalidTimestampError extends AppError {
  public constructor(message = "Creative intelligence timestamp is invalid.", details?: ErrorDetails) {
    super({
      message,
      statusCode: 400,
      code: "INVALID_CREATIVE_INTELLIGENCE_TIMESTAMP",
      ...(details === undefined ? {} : { details }),
    });
  }
}

export class CreativeIntelligenceMissingCreativeMaterialError extends AppError {
  public constructor(message = "Creative brief must contain meaningful creative material.", details?: ErrorDetails) {
    super({
      message,
      statusCode: 400,
      code: "MISSING_CREATIVE_MATERIAL",
      ...(details === undefined ? {} : { details }),
    });
  }
}
