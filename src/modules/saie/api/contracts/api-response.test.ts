import { describe, expect, it } from "vitest";

import {
  API_ERROR_CODES,
  createApiErrorResponse,
  createApiSuccessResponse,
  createDeterministicPaginationMeta,
  type ApiErrorCode,
} from "./index.js";

describe("SAIE API contracts", () => {
  it("creates a standard success response shape", () => {
    expect(createApiSuccessResponse({ status: "ok" })).toEqual({
      success: true,
      data: { status: "ok" },
    });
  });

  it("creates a standard error response shape", () => {
    expect(
      createApiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Workflow was not found.", {
        id: "missing-workflow",
      }),
    ).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Workflow was not found.",
        details: {
          id: "missing-workflow",
        },
      },
    });
  });

  it("creates deterministic pagination metadata", () => {
    expect(createDeterministicPaginationMeta(3)).toEqual({
      page: 1,
      pageSize: 3,
      totalItems: 3,
      totalPages: 1,
    });
    expect(createDeterministicPaginationMeta(0)).toEqual({
      page: 1,
      pageSize: 0,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it("keeps error codes typed and explicit", () => {
    const notFoundCode: ApiErrorCode = API_ERROR_CODES.NOT_FOUND;

    expect(Object.values(API_ERROR_CODES)).toEqual([
      "BAD_REQUEST",
      "VALIDATION_ERROR",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "SERVICE_UNAVAILABLE",
      "INTERNAL_ERROR",
    ]);
    expect(notFoundCode).toBe("NOT_FOUND");
  });
});
