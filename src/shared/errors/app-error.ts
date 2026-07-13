/**
 * Project: Sireh AI Commerce Platform
 * Module: Application Error
 * Sprint: SAI-02.06
 * Author: OpenAI + Codex
 * Status: Production Ready
 */

export type ErrorDetails = Record<string, unknown>;

interface AppErrorOptions {
  readonly message: string;
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational?: boolean;
  readonly details?: ErrorDetails;
}

function createOptions(
  message: string,
  statusCode: number,
  code: string,
  details?: ErrorDetails,
  isOperational?: boolean,
): AppErrorOptions {
  return {
    message,
    statusCode,
    code,
    ...(details === undefined ? {} : { details }),
    ...(isOperational === undefined ? {} : { isOperational }),
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetails;

  public constructor(options: AppErrorOptions) {
    super(options.message);

    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.isOperational = options.isOperational ?? true;

    if (options.details !== undefined) {
      this.details = options.details;
    }

    Error.captureStackTrace(this, AppError);
  }

  public static badRequest(
    message = "Bad request",
    details?: ErrorDetails,
    code = "BAD_REQUEST",
  ): AppError {
    return new AppError(createOptions(message, 400, code, details));
  }

  public static unauthorized(
    message = "Unauthorized",
    details?: ErrorDetails,
    code = "UNAUTHORIZED",
  ): AppError {
    return new AppError(createOptions(message, 401, code, details));
  }

  public static forbidden(
    message = "Forbidden",
    details?: ErrorDetails,
    code = "FORBIDDEN",
  ): AppError {
    return new AppError(createOptions(message, 403, code, details));
  }

  public static notFound(
    message = "Resource not found",
    details?: ErrorDetails,
    code = "NOT_FOUND",
  ): AppError {
    return new AppError(createOptions(message, 404, code, details));
  }

  public static conflict(
    message = "Conflict",
    details?: ErrorDetails,
    code = "CONFLICT",
  ): AppError {
    return new AppError(createOptions(message, 409, code, details));
  }

  public static internal(
    message = "Internal server error",
    details?: ErrorDetails,
    code = "INTERNAL_SERVER_ERROR",
  ): AppError {
    return new AppError(createOptions(message, 500, code, details, false));
  }
}
