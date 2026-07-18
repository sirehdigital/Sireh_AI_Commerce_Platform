import type { NextFunction, Request, RequestHandler, Response } from "express";

import {
  DEFAULT_TENANT_CONTEXT,
  ProcessLocalTenantRegistry,
  TENANT_CONTEXT_HEADERS,
  TenantContextValidationError,
  type TenantContext,
} from "../../application/index.js";
import { API_ERROR_CODES, createApiErrorResponse } from "../contracts/index.js";

const requestTenantContexts = new WeakMap<Request, TenantContext>();

export interface TenantContextMiddlewareOptions {
  readonly registry?: ProcessLocalTenantRegistry;
}

export const createTenantContextMiddleware = (
  options: TenantContextMiddlewareOptions = {},
): RequestHandler => {
  const registry = options.registry ?? new ProcessLocalTenantRegistry();

  return (request: Request, response: Response, next: NextFunction): void => {
    try {
      const context = registry.resolveTenant({
        tenantId: readHeader(request, TENANT_CONTEXT_HEADERS.tenantId) ?? DEFAULT_TENANT_CONTEXT.tenantId,
        storeId: readHeader(request, TENANT_CONTEXT_HEADERS.storeId) ?? DEFAULT_TENANT_CONTEXT.storeId,
        shopDomain: readHeader(request, TENANT_CONTEXT_HEADERS.shopDomain),
      });

      requestTenantContexts.set(request, context);
      response.setHeader("X-SAIE-Tenant-ID", context.tenantId);
      response.setHeader("X-SAIE-Store-ID", context.storeId);
      if (context.shopDomain !== undefined) {
        response.setHeader("X-SAIE-Shop-Domain", context.shopDomain);
      }
      response.setHeader("X-SAIE-Tenant-Auth", "not-enforced");

      next();
    } catch (error) {
      if (error instanceof TenantContextValidationError) {
        response.status(400).json(
          createApiErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, "Tenant context validation failed.", [
            { field: error.field, issue: error.message },
          ]),
        );
        return;
      }

      throw error;
    }
  };
};

export const getSaieTenantContext = (request: Request): TenantContext => {
  const context = requestTenantContexts.get(request);

  if (context === undefined) {
    throw new Error("SAIE tenant context was not resolved for this request.");
  }

  return context;
};

const readHeader = (request: Request, name: string): string | undefined => {
  const value = request.header(name);
  return value === undefined || value.trim().length === 0 ? undefined : value;
};

