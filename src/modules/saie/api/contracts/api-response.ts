import type { ApiErrorCode } from "./api-error-code.js";

export interface ApiSuccessResponse<TData, TMeta = undefined> {
  readonly success: true;
  readonly data: TData;
  readonly meta?: TMeta;
}

export interface ApiErrorDetail {
  readonly field?: string;
  readonly issue: string;
}

export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: readonly ApiErrorDetail[] | Record<string, unknown>;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiError;
}

export type ApiResponse<TData, TMeta = undefined> =
  | ApiSuccessResponse<TData, TMeta>
  | ApiErrorResponse;

export const createApiSuccessResponse = <TData, TMeta = undefined>(
  data: TData,
  meta?: TMeta,
): ApiSuccessResponse<TData, TMeta> => ({
  success: true,
  data,
  ...(meta === undefined ? {} : { meta }),
});

export const createApiErrorResponse = (
  code: ApiErrorCode,
  message: string,
  details?: readonly ApiErrorDetail[] | Record<string, unknown>,
): ApiErrorResponse => ({
  success: false,
  error: {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  },
});
