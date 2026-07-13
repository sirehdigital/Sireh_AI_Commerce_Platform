/**
 * Project: Sireh AI Commerce Platform
 * Module: Error Handler Middleware
 * Sprint: SAI-02.07
 * Author: OpenAI + Codex
 * Status: Production Ready
 */

import type { ErrorRequestHandler } from "express";

import { env } from "../config/env.js";
import { AppError, type ErrorDetails } from "../shared/errors/app-error.js";
import { logger } from "../shared/logger/logger.js";

interface ErrorResponseBody {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: ErrorDetails;
  };
}

function getUnknownErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
}

function createErrorResponse(error: AppError, includeDetails: boolean): ErrorResponseBody {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(includeDetails && error.details !== undefined ? { details: error.details } : {}),
    },
  };
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;

  const includeDetails = env.NODE_ENV === "development";

  if (error instanceof AppError && error.isOperational) {
    response.status(error.statusCode).json(createErrorResponse(error, includeDetails));
    return;
  }

  logger.error("Unexpected application error", {
    error: getUnknownErrorDetails(error),
  });

  const internalError = AppError.internal(
    "Internal server error",
    includeDetails ? getUnknownErrorDetails(error) : undefined,
  );

  response.status(500).json(createErrorResponse(internalError, includeDetails));
};
