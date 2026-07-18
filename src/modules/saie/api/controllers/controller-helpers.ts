import type { Response } from "express";

import {
  ApplicationNotFoundError,
  ApprovalVersionConflictError,
  InvalidApprovalTransitionError,
} from "../../application/index.js";
import { API_ERROR_CODES } from "../contracts/index.js";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  type ApiErrorDetail,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type PaginationMeta,
} from "../contracts/index.js";

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/;

export const sendSuccess = <TData, TMeta = undefined>(
  response: Response,
  data: TData,
  meta?: TMeta,
): void => {
  response.status(200).json(createApiSuccessResponse(data, meta));
};

export const sendListSuccess = <TData>(
  response: Response,
  data: readonly TData[],
  meta: PaginationMeta,
): void => {
  response.status(200).json(createApiSuccessResponse(data, meta));
};

export const sendNotFound = (response: Response, resourceName: string, id: string): void => {
  response.status(404).json(
    createApiErrorResponse(API_ERROR_CODES.NOT_FOUND, `${resourceName} was not found.`, {
      id,
      source: "deterministic-preview",
    }),
  );
};

export const sendValidationError = (
  response: Response,
  details: readonly ApiErrorDetail[],
): void => {
  response.status(400).json(
    createApiErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, "Route parameter validation failed.", details),
  );
};

export const sendApplicationError = (response: Response, error: unknown): boolean => {
  if (error instanceof ApplicationNotFoundError) {
    sendNotFound(response, error.resourceName, error.resourceId);
    return true;
  }

  if (
    error instanceof ApprovalVersionConflictError ||
    error instanceof InvalidApprovalTransitionError
  ) {
    response.status(409).json(createApiErrorResponse(API_ERROR_CODES.CONFLICT, error.message));
    return true;
  }

  return false;
};

export const validateRouteId = (
  value: string | readonly string[] | undefined,
  field: string,
): { readonly valid: true; readonly id: string } | { readonly valid: false; readonly details: readonly ApiErrorDetail[] } => {
  const id = typeof value === "string" ? value.trim() : "";

  if (id.length === 0) {
    return {
      valid: false,
      details: [{ field, issue: "ID is required." }],
    };
  }

  if (!SAFE_ID_PATTERN.test(id)) {
    return {
      valid: false,
      details: [{ field, issue: "ID must use lowercase letters, numbers, and hyphens only." }],
    };
  }

  return {
    valid: true,
    id,
  };
};

export type ControllerSuccess<TData, TMeta = undefined> = ApiSuccessResponse<TData, TMeta>;
export type ControllerError = ApiErrorResponse;
