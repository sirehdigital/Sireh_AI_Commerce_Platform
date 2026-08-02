import { AppError, type ErrorDetails } from "../../../../shared/errors/app-error.js";

export class InvalidCampaignRequestError extends AppError {
  public constructor(message = "Campaign strategy request is invalid.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "INVALID_CAMPAIGN_REQUEST", ...(details === undefined ? {} : { details }) });
  }
}

export class InvalidAudienceError extends AppError {
  public constructor(message = "Campaign audience profile is invalid.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "INVALID_CAMPAIGN_AUDIENCE", ...(details === undefined ? {} : { details }) });
  }
}

export class InvalidProductContextError extends AppError {
  public constructor(message = "Product campaign context is invalid.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "INVALID_PRODUCT_CAMPAIGN_CONTEXT", ...(details === undefined ? {} : { details }) });
  }
}

export class InvalidOfferError extends AppError {
  public constructor(message = "Campaign offer strategy is invalid.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "INVALID_CAMPAIGN_OFFER", ...(details === undefined ? {} : { details }) });
  }
}

export class UnsupportedObjectiveError extends AppError {
  public constructor(message = "Campaign objective is not supported.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "UNSUPPORTED_CAMPAIGN_OBJECTIVE", ...(details === undefined ? {} : { details }) });
  }
}

export class UnsupportedAngleError extends AppError {
  public constructor(message = "Campaign messaging angle is not supported.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "UNSUPPORTED_CAMPAIGN_MESSAGING_ANGLE", ...(details === undefined ? {} : { details }) });
  }
}

export class UnsupportedChannelError extends AppError {
  public constructor(message = "Campaign channel is not supported.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "UNSUPPORTED_CAMPAIGN_CHANNEL", ...(details === undefined ? {} : { details }) });
  }
}

export class InvalidTimestampError extends AppError {
  public constructor(message = "Campaign strategy timestamp is invalid.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "INVALID_CAMPAIGN_TIMESTAMP", ...(details === undefined ? {} : { details }) });
  }
}

export class MalformedCampaignStrategyError extends AppError {
  public constructor(message = "Campaign strategy is malformed.", details?: ErrorDetails) {
    super({ message, statusCode: 400, code: "MALFORMED_CAMPAIGN_STRATEGY", ...(details === undefined ? {} : { details }) });
  }
}

